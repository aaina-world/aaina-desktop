import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Photo, Shoot } from "../../../lib/contract";
import { freshApi } from "../../../test/mockApi";
import { renderRoutes } from "../../../test/render";
import { ViewerScreen } from ".";

vi.mock("../../../lib/api", async () => (await import("../../../test/mockApi")).apiModule);

let api: Awaited<ReturnType<typeof freshApi>>;
let shoot: Shoot;
let strip: Photo[];
beforeEach(async () => {
  api = await freshApi();
  shoot = (await api.shoots()).find((s) => s.name === "Camel coat")!;
  strip = (await api.photos(shoot.id)).filter((p) => p.status === "done");
});
const open = (photo: Photo) =>
  renderRoutes({ "/photo/:id": <ViewerScreen />, "/shoots/:id": <div>Shoot page</div> }, `/photo/${photo.id}?shoot=${shoot.id}`);
const here = () => screen.getByTestId("where").textContent;

describe("Photo viewer", () => {
  it("shows the photo with its place in the shoot", async () => {
    open(strip[0]);
    expect(await screen.findByRole("img", { name: new RegExp(`${strip[0].title}, Camel coat`) })).toBeInTheDocument();
    expect(screen.getByText(`1 of ${strip.length}`)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Photo viewer" })).toHaveAttribute("aria-modal", "true");
    expect(screen.queryByRole("button", { name: "Previous photo" })).not.toBeInTheDocument();
  });

  it("→ and ← move between photos, and stop at both ends", async () => {
    const user = userEvent.setup();
    open(strip[0]);
    await screen.findByText(`1 of ${strip.length}`);
    await user.keyboard("{ArrowRight}");
    await screen.findByText(`2 of ${strip.length}`);
    expect(here()).toContain(`/photo/${strip[1].id}`);
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await screen.findByText(`${strip.length} of ${strip.length}`);
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText(`${strip.length} of ${strip.length}`)).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    await screen.findByText(`${strip.length - 1} of ${strip.length}`);
    expect(screen.getByRole("button", { name: "Next photo" })).toBeInTheDocument();
  });

  it("the arrow buttons do the same", async () => {
    const user = userEvent.setup();
    open(strip[1]);
    await user.click(await screen.findByRole("button", { name: "Next photo" }));
    await screen.findByText(`3 of ${strip.length}`);
    await user.click(screen.getByRole("button", { name: "Previous photo" }));
    await screen.findByText(`2 of ${strip.length}`);
  });

  it("Esc closes back to the shoot", async () => {
    const user = userEvent.setup();
    open(strip[0]);
    await screen.findByText(`1 of ${strip.length}`);
    await user.keyboard("{Escape}");
    expect(await screen.findByText("Shoot page")).toBeInTheDocument();
    expect(here()).toBe(`/shoots/${shoot.id}`);
  });

  it("Space zooms in and out", async () => {
    const user = userEvent.setup();
    open(strip[0]);
    await screen.findByText(`1 of ${strip.length}`);
    const zoom = screen.getByRole("button", { name: "Zoom" });
    expect(zoom).toHaveAttribute("aria-pressed", "false");
    await user.keyboard(" ");
    expect(zoom).toHaveAttribute("aria-pressed", "true");
    await user.keyboard(" ");
    expect(zoom).toHaveAttribute("aria-pressed", "false");
  });

  it("keys are ignored while typing in a field, and while a dialog is open", async () => {
    const user = userEvent.setup();
    open(strip[0]);
    await screen.findByText(`1 of ${strip.length}`);
    await user.keyboard("{Delete}");
    const dialog = await screen.findByRole("alertdialog");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText(`1 of ${strip.length}`)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(dialog).not.toBeInTheDocument();
    expect(here()).toContain(`/photo/${strip[0].id}`);
  });

  it("Delete asks first and then removes the photo from the shoot", async () => {
    const user = userEvent.setup();
    open(strip[0]);
    await screen.findByText(`1 of ${strip.length}`);
    await user.keyboard("{Backspace}");
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(async () => expect((await api.photos(shoot.id)).some((p) => p.id === strip[0].id)).toBe(false));
  });

  it("a change that can't start says why next to the tools, and nothing is queued", async () => {
    vi.spyOn(api, "makeAgain").mockRejectedValue(new Error("Connect to OpenAI first."));
    const user = userEvent.setup();
    open(strip[0]);
    await user.click(await screen.findByRole("button", { name: /Make again/ }));
    expect(await screen.findByText("Connect to OpenAI first. Nothing was sent to OpenAI.")).toBeInTheDocument();
  });

  it("a photo that is not there says so and offers a way out", async () => {
    renderRoutes({ "/photo/:id": <ViewerScreen />, "/shoots/:id": <div>Shoot page</div> }, `/photo/nope?shoot=${shoot.id}`);
    expect(await screen.findByText("We can't find that photo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Close/ })).toHaveAttribute("href", `/shoots/${shoot.id}`);
  });
});
