// Google Analytics (the same property as aaina.world; reports are told apart by host name). Only the live site reports,
// and only the page address without its query is sent. The app itself never has analytics.
(function () {
  if (location.hostname !== "desktop.aaina.world") return;
  var ID = "G-9H5S7WSG3M";
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", ID, { page_location: location.origin + location.pathname });
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  document.head.appendChild(s);

  // Downloads, GitHub and coffee links, so it is clear what visitors do.
  document.addEventListener(
    "click",
    function (e) {
      var a = e.target.closest && e.target.closest("a");
      if (!a) return;
      var href = a.href || "";
      var kind = /releases/.test(href) ? "download" : /github\.com/.test(href) ? "github" : /buymeacoffee/.test(href) ? "coffee" : null;
      if (!kind) return;
      var box = a.closest("header, section, footer");
      window.gtag("event", kind + "_click", {
        button_text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
        section: box ? box.id || box.className.split(" ")[0] || box.tagName.toLowerCase() : "page",
        link_url: href.split("?")[0],
      });
    },
    { capture: true },
  );
})();
