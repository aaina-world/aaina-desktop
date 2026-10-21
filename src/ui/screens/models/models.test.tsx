import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshApi } from "../../../test/mockApi";
import { renderRoutes } from "../../../test/render";
import { ModelCreateScreen, ModelScreen } from ".";

vi.mock("../../../lib/api", async () => (await import("../../../test/mockApi")).apiModule);

let api: Awaited<ReturnType<typeof freshApi>>;
beforeEach(async () => {
  api = await freshApi();
  await api.setKey("sk-" + "a1B2c3D4".repeat(4));
});

describe("Create a model from a description", () => {
  it("shows the faces being made on step 2, then the faces to pick from", async () => {
    const model = await api.createOwnModelFromWords({ name: "Riya", gender: "woman", age: 30 });
    renderRoutes({ "/models/new": <ModelCreateScreen /> }, `/models/new?m=${model.id}`);
    expect(await screen.findByText("Making 3 faces")).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent("Pick a face");
    expect(screen.queryByText("Making the reference sheet")).toBeNull();
    expect(await screen.findByRole("heading", { name: "Pick a face" }, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe("Own model page", () => {
  it("asks before making a new, billed sheet", async () => {
    const remake = vi.spyOn(api, "remakeSheet");
    const user = userEvent.setup();
    renderRoutes({ "/models/:id": <ModelScreen /> }, "/models/own-1");
    await user.click(await screen.findByRole("button", { name: /New sheet/ }));
    expect(await screen.findByText("Make a new reference sheet?")).toBeInTheDocument();
    expect(remake).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Make a new sheet" }));
    await waitFor(() => expect(remake).toHaveBeenCalledWith("own-1"));
  });
});
