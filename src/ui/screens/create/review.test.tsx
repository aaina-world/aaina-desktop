import { screen, waitFor, within } from "@testing-library/react";
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
const open = () =>
  renderRoutes({ "/create/:shootId/:step": <CreateScreen />, "/shoots/:id": <div>Shoot page</div> }, `/create/${draft.id}/review`);
const withKey = () => api.setKey("sk-" + "a1B2c3D4".repeat(4));

describe("Create → Review", () => {
  it("counts one photo per pose and shows the rough price before anything is sent", async () => {
    await withKey();
    open();
    const make = await screen.findByRole("button", { name: /Make 1 photo/ });
    expect(make).toHaveTextContent("about $0.05");
    expect(screen.getByText(/Nothing is sent until you press Make/)).toBeInTheDocument();
  });

  it("multiplies the price by the poses and switches to High quality", async () => {
    await withKey();
    await api.updateShoot(draft.id, { plan: [0, 1, 2, 3].map(() => draft.plan[0]) });
    const user = userEvent.setup();
    open();
    const make = await screen.findByRole("button", { name: /Make 4 photos/ });
    expect(make).toHaveTextContent("about $0.20");
    await user.click(screen.getByRole("tab", { name: "High" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Make 4 photos/ })).toHaveTextContent("about $0.80"));
    await waitFor(async () => expect((await api.shoot(draft.id))!.quality).toBe("high"));
  });

  it("removing a pose lowers the count and the price, and the draft keeps it", async () => {
    await withKey();
    await api.updateShoot(draft.id, { plan: [0, 1, 2].map(() => draft.plan[0]) });
    const user = userEvent.setup();
    open();
    await screen.findByRole("button", { name: /Make 3 photos/ });
    await user.click(screen.getAllByRole("button", { name: "Remove pose" })[0]);
    expect(await screen.findByRole("button", { name: /Make 2 photos/ })).toHaveTextContent("about $0.10");
    await waitFor(async () => expect((await api.shoot(draft.id))!.plan).toHaveLength(2));
  });

  it("frame and expression are chosen per pose and are free", async () => {
    await withKey();
    const user = userEvent.setup();
    open();
    await screen.findByRole("button", { name: /Make 1 photo/ });
    const frame = screen.getByRole("button", { name: "Waist up" });
    await user.click(frame);
    expect(frame).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Soft smile" }));
    await waitFor(async () => {
      const [shot] = (await api.shoot(draft.id))!.plan;
      expect(shot).toMatchObject({ frame: "waist-up", expression: "soft-smile" });
    });
    expect(screen.getByRole("button", { name: /Make 1 photo/ })).toHaveTextContent("about $0.05");
  });

  it("without a key it explains and keeps Make disabled", async () => {
    open();
    expect(await screen.findByText(/Add your OpenAI key in Settings/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add your key" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: /Make 1 photo/ })).toBeDisabled();
  });

  it("with no poses left there is nothing to make", async () => {
    await withKey();
    await api.updateShoot(draft.id, { plan: [] });
    open();
    // A draft without poses opens at the Poses step instead of Review.
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/\/poses$/));
    expect(screen.queryByRole("button", { name: /Make 0 photos/ })).not.toBeInTheDocument();
  });

  it("Make photos queues the shoot and opens its page", async () => {
    await withKey();
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: /Make 1 photo/ }));
    expect(await screen.findByText("Shoot page")).toBeInTheDocument();
    const made = await api.shoot(draft.id);
    expect(made!.status).toBe("making");
    expect((await api.photos(draft.id)).length).toBeGreaterThanOrEqual(1);
  });

  it("says which product, model and scene are used, each with a Change link", async () => {
    open();
    await screen.findByRole("button", { name: /Make 1 photo/ });
    expect(screen.getAllByText(draft.name).length).toBeGreaterThan(0);
    const changes = screen.getAllByRole("link", { name: "Change" });
    expect(changes.map((a) => a.getAttribute("href"))).toEqual([
      `/create/${draft.id}/product`,
      `/create/${draft.id}/model`,
      `/create/${draft.id}/scene`,
    ]);
    const stepper = screen.getByRole("navigation", { name: "Steps" });
    expect(within(stepper).getByText("Review").closest("[aria-current]")).not.toBeNull();
  });
});
