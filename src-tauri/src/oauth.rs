// The loopback redirect for "Sign in with ChatGPT" (OAuth with PKCE): the app listens on 127.0.0.1 for exactly one
// browser redirect, hands its query string to the web view, and shows a "you can close this tab" page.
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct Loopback(pub Mutex<Option<(TcpListener, String)>>);

#[tauri::command]
pub fn oauth_loopback_start(state: tauri::State<Loopback>, path: String) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    *state.0.lock().unwrap() = Some((listener, path));
    Ok(port)
}

const NOT_FOUND: &[u8] = b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";

/// The path and query of an HTTP request line ("GET /auth/callback?code=x HTTP/1.1"). A malformed request gives an empty path.
fn split_target(request: &str) -> (&str, &str) {
    let target = request.split_whitespace().nth(1).unwrap_or("");
    target.split_once('?').unwrap_or((target, ""))
}

/// The query string of the one request we are waiting for (the browser's redirect to `expected_path`), or None for anything else.
fn query_for<'a>(request: &'a str, expected_path: &str) -> Option<&'a str> {
    let (path, query) = split_target(request);
    (path == expected_path).then_some(query)
}

const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Aaina Desktop</title><body style=\"font:16px system-ui;padding:48px;color:#161615;background:#f7f7f5\"><h1 style=\"font-weight:500\">You're signed in</h1><p>You can close this tab and go back to Aaina Desktop.</p></body>";

#[tauri::command]
pub async fn oauth_loopback_wait(state: tauri::State<'_, Loopback>, timeout_secs: u64) -> Result<String, String> {
    let (listener, path) = state.0.lock().unwrap().take().ok_or("sign-in was not started")?;
    tauri::async_runtime::spawn_blocking(move || {
        let deadline = Instant::now() + Duration::from_secs(timeout_secs.min(900));
        loop {
            if Instant::now() > deadline {
                return Err("sign-in timed out".to_string());
            }
            match listener.accept() {
                Ok((mut stream, _)) => {
                    stream.set_nonblocking(false).ok();
                    stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
                    let mut buf = [0u8; 8192];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let request = String::from_utf8_lossy(&buf[..n]);
                    let Some(query) = query_for(&request, &path) else {
                        let _ = stream.write_all(NOT_FOUND);
                        continue;
                    };
                    let body = DONE_PAGE.as_bytes();
                    let head = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    );
                    let _ = stream.write_all(head.as_bytes());
                    let _ = stream.write_all(body);
                    return Ok(query.to_string());
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(100)),
                Err(e) => return Err(e.to_string()),
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    const PATH: &str = "/auth/callback";

    #[test]
    fn reads_the_query_of_the_redirect() {
        let request = "GET /auth/callback?code=abc&state=xyz HTTP/1.1\r\nHost: 127.0.0.1:1455\r\n\r\n";
        assert_eq!(query_for(request, PATH), Some("code=abc&state=xyz"));
    }

    #[test]
    fn a_redirect_without_a_query_gives_an_empty_one() {
        assert_eq!(query_for("GET /auth/callback HTTP/1.1\r\n\r\n", PATH), Some(""));
        assert_eq!(query_for("GET /auth/callback? HTTP/1.1\r\n\r\n", PATH), Some(""));
    }

    #[test]
    fn keeps_encoded_characters_and_extra_question_marks_as_they_are() {
        let request = "GET /auth/callback?error=access_denied&error_description=No%20thanks?really HTTP/1.1\r\n\r\n";
        assert_eq!(
            query_for(request, PATH),
            Some("error=access_denied&error_description=No%20thanks?really")
        );
    }

    #[test]
    fn other_paths_are_not_ours() {
        for request in [
            "GET /favicon.ico HTTP/1.1\r\n\r\n",
            "GET / HTTP/1.1\r\n\r\n",
            "GET /auth/callback/extra?code=1 HTTP/1.1\r\n\r\n",
            "GET /AUTH/CALLBACK?code=1 HTTP/1.1\r\n\r\n",
            "GET /x?next=/auth/callback HTTP/1.1\r\n\r\n",
        ] {
            assert_eq!(query_for(request, PATH), None, "{request:?}");
        }
    }

    #[test]
    fn garbage_and_empty_requests_are_not_ours() {
        assert_eq!(query_for("", PATH), None);
        assert_eq!(query_for("GET", PATH), None);
        assert_eq!(query_for("\u{0}\u{1}\u{2}", PATH), None);
        assert_eq!(split_target(""), ("", ""));
        assert_eq!(split_target("GET"), ("", ""));
    }

    #[test]
    fn the_method_does_not_matter_only_the_target() {
        assert_eq!(query_for("POST /auth/callback?code=1 HTTP/1.1\r\n\r\n", PATH), Some("code=1"));
    }

    #[test]
    fn not_found_is_a_complete_empty_response() {
        let text = std::str::from_utf8(NOT_FOUND).unwrap();
        assert!(text.starts_with("HTTP/1.1 404 Not Found\r\n"));
        assert!(text.contains("Content-Length: 0"));
        assert!(text.ends_with("\r\n\r\n"));
    }

    #[test]
    fn the_done_page_is_html_with_the_words_a_person_needs() {
        assert!(DONE_PAGE.contains("You're signed in"));
        assert!(DONE_PAGE.contains("close this tab"));
    }

    #[test]
    fn the_loopback_accepts_one_redirect_end_to_end() {
        use std::net::TcpStream;
        // The same steps the command takes, without the Tauri state: bind, accept, answer, hand the query on.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let client = std::thread::spawn(move || {
            let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
            stream
                .write_all(b"GET /auth/callback?code=1&state=2 HTTP/1.1\r\nHost: x\r\n\r\n")
                .unwrap();
            let mut answer = String::new();
            stream.read_to_string(&mut answer).unwrap();
            answer
        });
        let (mut stream, _) = listener.accept().unwrap();
        let mut buf = [0u8; 8192];
        let n = stream.read(&mut buf).unwrap();
        let request = String::from_utf8_lossy(&buf[..n]).to_string();
        assert_eq!(query_for(&request, PATH), Some("code=1&state=2"));
        stream.write_all(NOT_FOUND).unwrap();
        drop(stream);
        assert!(client.join().unwrap().starts_with("HTTP/1.1 404"));
    }
}
