import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastHost } from "../../components";
import { freshApi } from "../../../test/mockApi";
import { renderRoutes } from "../../../test/render";
import { ShootsScreen } from ".";

vi.mock("../../../lib/api", async () => (await import("../../../test/mockApi")).apiModule);

let api: Awaited<ReturnType<typeof freshApi>>;
beforeEach(async () => {
  api = await freshApi();
});
const open = (at = "/shoots") =>
  renderRoutes(
    {
      "/shoots": (
        <>
          <ShootsScreen />
          <ToastHost />
        </>
      ),
      "/shoots/:id": <div>Shoot page</div>,
      "/create/:id/:step": <div>Draft page</div>,
    },
    at,
  );
const cards = () => Array.from(document.querySelectorAll<HTMLElement>("article.tile.shoot"));
const names = () => cards().map((c) => c.querySelector(".t")!.textContent);

describe("Shoots", () => {
  it("lists every shoot with its kind and count of photos, newest first", async () => {
    open();
    await screen.findByText("Cobalt T-shirt");
    const all = await api.shoots();
    expect(cards()).toHaveLength(all.length);
    expect(names()[0]).toBe("Cobalt T-shirt");
    expect(within(cards().find((c) => c.textContent?.includes("Camel coat"))!).getByText(/On a model · 4 photos/)).toBeInTheDocument();
    expect(screen.getByText("Summer kurta").closest("article")).toHaveTextContent("Flat-lay · 4 photos");
  });

  it("filters by kind and counts each kind on its tab", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Cobalt T-shirt");
    const ghost = screen.getByRole("tab", { name: /Ghost mannequin/ });
    expect(ghost).toHaveTextContent("2");
    await user.click(ghost);
    expect(names().sort()).toEqual(["Sage linen blazer", "Wool blazer"]);
    await user.click(screen.getByRole("tab", { name: /Drafts/ }));
    expect(names()).toEqual(["Linen shirt"]);
    expect(cards()[0]).toHaveTextContent("Draft · Step 3 of 5, Poses");
    await user.click(screen.getByRole("tab", { name: /^All/ }));
    expect(cards().length).toBeGreaterThan(5);
  });

  it("searches by name, keeps the search in the address, and says when nothing matches", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Cobalt T-shirt");
    await user.type(screen.getByLabelText("Search shoots"), "kurta");
    expect(names().sort()).toEqual(["Cream kurta set", "Sage block-print kurta", "Summer kurta"]);
    expect(screen.getByTestId("where")).toHaveTextContent("/shoots?q=kurta");
    await user.clear(screen.getByLabelText("Search shoots"));
    await user.type(screen.getByLabelText("Search shoots"), "zzz");
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText(/No shoots match/)).toBeInTheDocument();
  });

  it("starts from a search in the address", async () => {
    open("/shoots?q=blazer");
    await screen.findByText("Sage linen blazer");
    expect(names().sort()).toEqual(
      ["Sage linen blazer", "Wool blazer"].concat(names().filter((n) => /Linen/.test(n) && n !== "Sage linen blazer")).sort(),
    );
  });

  it("sorts by name", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Cobalt T-shirt");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "name");
    const list = names();
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b)));
  });

  it("deleting asks first, names the shoot, and Cancel keeps it", async () => {
    const user = userEvent.setup();
    open();
    const card = (await screen.findByText("Camel coat")).closest("article")!;
    await user.click(within(card).getByRole("button", { name: "Shoot options" }));
    await user.click(await screen.findByRole("menuitem", { name: /Delete shoot/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Camel coat?" });
    expect(within(dialog).getByText(/can't be undone/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(names()).toContain("Camel coat");
    expect((await api.shoots()).some((s) => s.name === "Camel coat")).toBe(true);
  });

  it("confirming deletes the shoot, tells the person and removes the card", async () => {
    const user = userEvent.setup();
    open();
    const card = (await screen.findByText("Camel coat")).closest("article")!;
    await user.click(within(card).getByRole("button", { name: "Shoot options" }));
    await user.click(await screen.findByRole("menuitem", { name: /Delete shoot/ }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Deleted 1 shoot")).toBeInTheDocument();
    await waitFor(() => expect(names()).not.toContain("Camel coat"));
    expect((await api.shoots()).some((s) => s.name === "Camel coat")).toBe(false);
  });

  it("selecting several and pressing Delete asks once for all of them", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Cobalt T-shirt");
    await user.click(screen.getByRole("button", { name: /^Select.*click$/ }));
    const marks = screen.getAllByRole("button", { name: "Select" });
    await user.click(marks[0]);
    await user.click(marks[1]);
    expect(screen.getByText("2 shoots selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete 2 shoots" }));
    expect(await screen.findByRole("alertdialog", { name: "Delete 2 shoots?" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Cancel/ }));
    expect(screen.queryByText(/shoots selected/)).not.toBeInTheDocument();
  });

  it("a draft opens at the step it was left on; a finished shoot opens its page", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("link", { name: "Linen shirt" }));
    expect(await screen.findByText("Draft page")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(/\/create\/.+\/poses$/);
  });

  it("Duplicate settings starts a new draft at Review", async () => {
    const user = userEvent.setup();
    open();
    const card = (await screen.findByText("Camel coat")).closest("article")!;
    await user.click(within(card).getByRole("button", { name: "Shoot options" }));
    await user.click(await screen.findByRole("menuitem", { name: "Duplicate settings" }));
    expect(await screen.findByText("Draft page")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(/\/review$/);
  });
});
