import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshApi } from "../../../test/mockApi";
import { ConnectScreen } from ".";

vi.mock("../../../lib/api", async () => (await import("../../../test/mockApi")).apiModule);

const GOOD_KEY = "sk-" + "a1B2c3D4".repeat(4);
let api: Awaited<ReturnType<typeof freshApi>>;
beforeEach(async () => {
  api = await freshApi();
});
const open = () =>
  render(
    <MemoryRouter>
      <ConnectScreen />
    </MemoryRouter>,
  );

describe("Connect: the OpenAI key", () => {
  it("asks for a key before checking anything", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Check key" }));
    expect(screen.getByText("Paste your OpenAI key first.")).toBeInTheDocument();
  });

  it("with a key already saved, an empty box checks the saved key instead of asking for one", async () => {
    const user = userEvent.setup();
    await api.setKey(GOOD_KEY);
    const spy = vi.spyOn(api, "checkKey");
    open();
    await user.click(await screen.findByRole("button", { name: "Check key" }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Paste your OpenAI key first.")).not.toBeInTheDocument();
  });

  it("hides the key as it is typed and can show it", async () => {
    const user = userEvent.setup();
    open();
    const input = await screen.findByLabelText("API key");
    expect(input).toHaveAttribute("type", "password");
    await user.type(input, "sk-secret");
    await user.click(screen.getByRole("button", { name: "Show key" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide key" })).toBeInTheDocument();
  });

  it("a key OpenAI accepts is saved, cleared from the box and confirmed in words", async () => {
    const user = userEvent.setup();
    open();
    const input = await screen.findByLabelText("API key");
    await user.type(input, GOOD_KEY);
    await user.click(screen.getByRole("button", { name: "Check key" }));
    expect(await screen.findByText("Key works. You can make photos.")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", `Saved: sk-…${GOOD_KEY.slice(-4)}`);
    expect((await api.connection()).canMakePhotos).toBe(true);
  });

  it("a key that is refused says so next to the field and the error goes when typing again", async () => {
    const user = userEvent.setup();
    open();
    const input = await screen.findByLabelText("API key");
    await user.type(input, "sk-refused-key-0000000000");
    await user.click(screen.getByRole("button", { name: "Check key" }));
    expect(await screen.findByText(/OpenAI didn't accept this key/)).toBeInTheDocument();
    await user.type(input, "x");
    expect(screen.queryByText(/OpenAI didn't accept this key/)).not.toBeInTheDocument();
  });

  it("an account that must verify its organisation, or is out of credit, is told what to do", async () => {
    const user = userEvent.setup();
    open();
    const input = await screen.findByLabelText("API key");
    await user.type(input, GOOD_KEY + "verify");
    await user.click(screen.getByRole("button", { name: "Check key" }));
    expect(await screen.findByText(/verify the organisation/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open OpenAI settings" })).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, GOOD_KEY + "credit");
    await user.click(screen.getByRole("button", { name: "Check key" }));
    expect(await screen.findByText(/out of credit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open OpenAI billing" })).toBeInTheDocument();
  });

  it("shows a saved key and lets it be removed", async () => {
    const user = userEvent.setup();
    await api.setKey(GOOD_KEY);
    open();
    expect(await screen.findByText("Key works. You can make photos.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText("Key works. You can make photos.")).not.toBeInTheDocument());
    expect((await api.connection()).key.present).toBe(false);
  });

  it("says where the key is kept and what a photo costs", async () => {
    open();
    expect(await screen.findByText(/Kept in .* and sent only to OpenAI/)).toBeInTheDocument();
    expect(screen.getByText(/About \$0\.05 a photo/)).toBeInTheDocument();
  });
});

describe("Connect: ChatGPT and leaving", () => {
  it("signing in shows who is signed in, and signing out goes back", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Sign in with ChatGPT" }));
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: "Sign in with ChatGPT" })).toBeInTheDocument();
  });

  it("is step 2 of 3, with Back to the welcome screen and Continue to setup", async () => {
    open();
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("link", { name: /Back/ })).toHaveAttribute("href", "/welcome");
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/setup");
  });

  it("Skip for now finishes onboarding", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Skip for now" }));
    await waitFor(async () => expect((await api.settings()).onboarded).toBe(true));
  });
});
