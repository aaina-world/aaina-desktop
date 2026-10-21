import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshApi } from "../../../test/mockApi";
import { renderRoutes } from "../../../test/render";
import { SettingsScreen } from ".";

vi.mock("../../../lib/api", async () => (await import("../../../test/mockApi")).apiModule);

let api: Awaited<ReturnType<typeof freshApi>>;
beforeEach(async () => {
  api = await freshApi();
});
const open = () => renderRoutes({ "/settings": <SettingsScreen /> }, "/settings");

describe("Settings → Your data", () => {
  it("restores a backup folder only after saying what it replaces", async () => {
    vi.spyOn(api, "pickFolder").mockResolvedValue("/Volumes/USB/Aaina backup 2026-10-21");
    const restore = vi.spyOn(api, "restore").mockResolvedValue(undefined);
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Restore" }));
    expect(await screen.findByText(/replaced with the ones in “Aaina backup 2026-10-21”/)).toBeInTheDocument();
    expect(restore).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Restore and restart" }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith("/Volumes/USB/Aaina backup 2026-10-21"));
  });

  it("does nothing when no folder is picked", async () => {
    vi.spyOn(api, "pickFolder").mockResolvedValue(null);
    const restore = vi.spyOn(api, "restore");
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Restore" }));
    expect(screen.queryByText("Restore this backup?")).toBeNull();
    expect(restore).not.toHaveBeenCalled();
  });
});

describe("Settings → Updates", () => {
  it("offers a check when the app opens, never a promise to install by itself", async () => {
    open();
    expect(await screen.findByText("Check for updates when the app opens")).toBeInTheDocument();
    expect(screen.queryByText(/Install new versions/)).toBeNull();
  });
});

describe("Settings → menu", () => {
  it("keeps the section picked from the menu lit", async () => {
    const user = userEvent.setup();
    open();
    const yourData = await screen.findByRole("link", { name: "Your data" });
    await user.click(yourData);
    window.dispatchEvent(new Event("scroll"));
    expect(yourData).toHaveAttribute("aria-current", "true");
  });
});
