import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshApi } from "../../../test/mockApi";
import { renderRoutes } from "../../../test/render";
import { CreateScreen } from ".";

vi.mock("../../../lib/api", async () => (await import("../../../test/mockApi")).apiModule);

let api: Awaited<ReturnType<typeof freshApi>>;
beforeEach(async () => {
  api = await freshApi();
});

describe("New shoot with this model", () => {
  it("keeps the model when a past product is picked, and the summary shows it at once", async () => {
    const own = (await api.ownModels())[0];
    const user = userEvent.setup();
    renderRoutes({ "/create/new": <CreateScreen />, "/create/:shootId/:step": <CreateScreen /> }, "/create/new", {
      model: { source: "own", id: own.id },
    });
    await user.click(await screen.findByRole("button", { name: "Use a past product" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector(".tile.selectable")).not.toBeNull());
    await user.click(dialog.querySelector<HTMLElement>(".tile.selectable")!);
    await user.click(within(dialog).getByRole("button", { name: "Use this product" }));
    await waitFor(() => expect(screen.getAllByText(new RegExp(own.name)).length).toBeGreaterThan(0));
  });
});
