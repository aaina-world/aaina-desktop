import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoutes } from "../../../test/render";
import { freshApi } from "../../../test/mockApi";
import type { Shoot } from "../../../lib/contract";
import { CreateScreen } from ".";

vi.mock("../../../lib/api", async () => (await import("../../../test/mockApi")).apiModule);

let api: Awaited<ReturnType<typeof freshApi>>;
let draft: Shoot;
beforeEach(async () => {
  api = await freshApi();
  draft = (await api.shoots({ kind: "draft" }))[0];
});
const open = () => renderRoutes({ "/create/:shootId/:step": <CreateScreen /> }, `/create/${draft.id}/scene`);

describe("Create → Scene → Colour", () => {
  it("keeps a typed hex code as typed, and the scene becomes that colour once it is one", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("tab", { name: "Colour" }));
    const box = screen.getByRole("textbox", { name: "Hex colour" });
    await user.clear(box);
    await user.type(box, "#1f4e79");
    expect(box).toHaveValue("#1f4e79");
    await waitFor(async () => expect((await api.shoot(draft.id))!.scene).toMatchObject({ source: "colour", hex: "#1f4e79" }));
  });

  it("a swatch fills the box with its code", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("tab", { name: "Colour" }));
    await user.click(screen.getByRole("button", { name: "Navy" }));
    await waitFor(() => expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Hex colour" }).value).toMatch(/^#[0-9a-f]{6}$/));
    expect(screen.getByText(/Closest name: Navy/)).toBeInTheDocument();
  });
});
