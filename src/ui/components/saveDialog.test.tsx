import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshApi } from "../../test/mockApi";
import type { Photo } from "../../lib/contract";
import { SaveDialog } from "./dialogs";

vi.mock("../../lib/api", async () => (await import("../../test/mockApi")).apiModule);

let api: Awaited<ReturnType<typeof freshApi>>;
let photos: Photo[];
beforeEach(async () => {
  api = await freshApi();
  const shoot = (await api.shoots()).find((s) => s.status === "done")!;
  photos = (await api.photos(shoot.id)).filter((p) => p.status === "done");
});

describe("Save photos", () => {
  it("saves into a new folder in Downloads, not the folder where the app keeps its photos", async () => {
    render(<SaveDialog photos={photos} shootName="Blue kurta" onClose={() => undefined} />);
    expect(await screen.findByText("~/Downloads/Blue kurta")).toBeInTheDocument();
  });

  it("remembers a folder the person picks for next time", async () => {
    vi.spyOn(api, "pickFolder").mockResolvedValue("/Users/me/Listings");
    const user = userEvent.setup();
    render(<SaveDialog photos={photos.slice(0, 1)} shootName="Blue kurta" onClose={() => undefined} />);
    await user.click(await screen.findByRole("button", { name: "Change" }));
    expect(await screen.findByText("/Users/me/Listings")).toBeInTheDocument();
    await waitFor(async () => expect((await api.settings()).saveFolder).toBe("/Users/me/Listings"));
  });

  it("never promises a size or a white background the file will not have", async () => {
    render(<SaveDialog photos={photos} shootName="Blue kurta" onClose={() => undefined} />);
    await screen.findByText("Amazon");
    expect(screen.queryByText(/2048|2000 × 1500/)).toBeNull();
    expect(screen.getByText("1:1 · plain walls made pure white")).toBeInTheDocument();
    expect(screen.getByText("4:3 · scenes stay square")).toBeInTheDocument();
  });
});
