import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const settings = vi.fn();
vi.mock("../lib/api", () => ({ inApp: false, api: async () => ({ settings, updateSettings: vi.fn() }) }));
vi.mock("../lib/log", () => ({ logWarning: vi.fn(async () => undefined), logInfo: vi.fn(async () => undefined) }));

describe("starting the app", () => {
  it("says why it couldn't start, instead of an empty window, and tries again", async () => {
    settings.mockRejectedValueOnce(new Error("The photos folder could not be found"));
    settings.mockResolvedValue(null); // the second try gets no further, but asks again
    const { default: App } = await import("./App");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Aaina Desktop couldn't start" })).toBeInTheDocument();
    expect(screen.getByText("The photos folder could not be found")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(settings).toHaveBeenCalledTimes(2);
  });
});
