import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./dialogs";
import { Cost, costText, formatUsd } from "./Cost";
import { Dialog } from "./Dialog";
import { Segmented, Switch } from "./controls";
import { FieldError, Notice } from "./Notice";
import { ToastHost, toast } from "./Toast";
import { formatAgo, formatBytes, formatDate, formatDateTime, plural, sentence } from "./format";

describe("Dialog", () => {
  function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open it</button>
        {open && (
          <Dialog
            title="Rename shoot"
            description="Pick a new name"
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            footer={
              <>
                <button>Cancel</button>
                <button className="btn-primary">Save</button>
              </>
            }
          >
            <input aria-label="Name" />
          </Dialog>
        )}
      </>
    );
  }

  it("is a labelled modal dialog and puts focus on the first field", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open it" }));
    const dialog = screen.getByRole("dialog", { name: "Rename shoot" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("keeps Tab inside, wrapping from the last control to the first and back", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open it" }));
    const close = screen.getByRole("button", { name: "Close" });
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(save).toHaveFocus();
  });

  it("closes on Esc and gives focus back to what opened it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open it" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes from the X and from a click on the scrim, but not from a click inside", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Open it" }));
    await user.click(screen.getByLabelText("Name"));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Open it" }));
    await user.pointer({ keys: "[MouseLeft]", target: document.querySelector(".scrim")! });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("an alert dialog uses the alertdialog role", () => {
    render(<Dialog alert title="Sure?" onClose={() => undefined} />);
    expect(screen.getByRole("alertdialog", { name: "Sure?" })).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("names the action, puts focus on the confirm button, confirms and cancels", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        danger
        title="Delete Cobalt T-shirt?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveFocus();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
  it("disables the confirm button while busy so nothing is deleted twice", () => {
    render(
      <ConfirmDialog busy title="Delete?" description="x" confirmLabel="Delete" onConfirm={() => undefined} onClose={() => undefined} />,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});

describe("Segmented", () => {
  it("marks the chosen option, shows counts and reports a change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Segmented
        label="Kind"
        value="all"
        onChange={onChange}
        options={[
          { value: "all", label: "All", count: 5 },
          { value: "draft", label: "Drafts", count: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("tablist", { name: "Kind" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Drafts/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Drafts/ })).toHaveTextContent("1");
    await user.click(screen.getByRole("tab", { name: /Drafts/ }));
    expect(onChange).toHaveBeenCalledWith("draft");
  });
});

describe("Switch", () => {
  it("is a labelled switch that flips", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Notify me" />);
    const s = screen.getByRole("switch", { name: "Notify me" });
    expect(s).toHaveAttribute("aria-checked", "false");
    await user.click(s);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("cost words", () => {
  it("formats small amounts with the cents they need and bigger ones to the cent", () => {
    expect(formatUsd(0.05)).toBe("$0.05");
    expect(formatUsd(0.002)).toBe("$0.002");
    expect(formatUsd(0.2)).toBe("$0.20");
    expect(formatUsd(1.5)).toBe("$1.50");
  });
  it("is always rough, and multiplies for several", () => {
    expect(costText(0.05)).toBe("about $0.05");
    expect(costText(0.05, { unit: "a photo" })).toBe("about $0.05 a photo");
    expect(costText(0.05, { count: 3 })).toBe("3 × about $0.05");
    expect(costText(0.05, { count: 1 })).toBe("about $0.05");
  });
  it("renders as text", () => {
    render(<Cost usd={0.2} unit="a photo" />);
    expect(screen.getByText("about $0.20 a photo")).toHaveClass("cost");
  });
});

describe("Notice", () => {
  it("shows its words and runs its action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Notice tone="warning" action={{ label: "Open billing", onClick }}>
        Out of credit
      </Notice>,
    );
    expect(screen.getByText("Out of credit")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open billing" }));
    expect(onClick).toHaveBeenCalled();
  });
  it("a field error reads as an alert", () => {
    render(<FieldError>Paste your OpenAI key first.</FieldError>);
    expect(screen.getByText("Paste your OpenAI key first.")).toBeInTheDocument();
  });
});

describe("Toast", () => {
  it("shows a message in a polite live region and fades it away by itself", () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => toast("Copied"));
    expect(screen.getByText("Copied")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(3300));
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });
  it("an Undo action stays longer and runs once, then the toast goes", async () => {
    vi.useFakeTimers();
    const undo = vi.fn();
    render(<ToastHost />);
    act(() => toast("Deleted 1 shoot", { action: { label: "Undo", onClick: undo } }));
    act(() => void vi.advanceTimersByTime(4000));
    expect(screen.getByText("Deleted 1 shoot")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Undo" });
    act(() => button.click());
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Deleted 1 shoot")).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(7000));
  });
});

describe("format", () => {
  it("never shows seconds, and writes months in words", () => {
    const d = new Date(2026, 9, 21, 21, 5, 33);
    expect(formatDate(d)).toBe("21 Oct 2026");
    expect(formatDateTime(d)).toBe("21 Oct 2026, 9:05 pm");
    expect(formatDateTime(new Date(2026, 0, 2, 0, 7))).toBe("2 Jan 2026, 12:07 am");
  });
  it("says how long ago in the friendliest words", () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(formatAgo(ago(5_000))).toBe("just now");
    expect(formatAgo(ago(5 * 60_000))).toBe("5 min ago");
    expect(formatAgo(ago(3 * 3_600_000))).toBe("3 h ago");
    expect(formatAgo(ago(30 * 3_600_000))).toBe("yesterday");
    expect(formatAgo(ago(10 * 86_400_000))).toMatch(/^\d{1,2} \w{3} \d{4}$/);
  });
  it("sizes, plurals and sentences", () => {
    expect(formatBytes(500)).toBe("1 KB");
    expect(formatBytes(5_000_000)).toBe("5 MB");
    expect(formatBytes(1_288_490_188)).toBe("1.3 GB");
    expect(plural(1, "photo")).toBe("1 photo");
    expect(plural(3, "photo")).toBe("3 photos");
    expect(plural(2, "category", "categories")).toBe("2 categories");
    expect(sentence("make again")).toBe("Make again");
    expect(sentence("")).toBe("");
  });
});
