import { describe, expect, it } from "vitest";
import type { Photo, Settings, Shoot } from "../contract";
import { engineError } from "./errors";
import { createQueue } from "./queue";

const png = (() => {
  const b = new Uint8Array(40);
  b.set([0x89, 0x50, 0x4e, 0x47]);
  new DataView(b.buffer).setUint32(16, 1536);
  new DataView(b.buffer).setUint32(20, 1536);
  return b;
})();
const photo = (id: string, shootId = "s1"): Photo => ({
  id,
  shootId,
  shotKey: id,
  shot: { kind: "ghost", angle: "front" },
  title: id,
  version: 1,
  parentId: null,
  change: { kind: "new" },
  status: "queued",
  error: null,
  path: null,
  url: null,
  width: null,
  height: null,
  estimateUsd: 0.05,
  startedAt: null,
  finishedAt: null,
  createdAt: "",
});
const settings =
  (parallel: Settings["parallel"] = 2, notifyWhenReady = true) =>
  async () =>
    ({ parallel, notifyWhenReady }) as Settings;

function fake(photos: Photo[]) {
  const log: string[] = [];
  const rows = new Map(photos.map((p) => [p.id, { ...p }]));
  const store = {
    queued: async (n: number) => [...rows.values()].filter((p) => p.status === "queued").slice(0, n),
    photo: async (id: string) => rows.get(id) ?? null,
    shoot: async () => ({ id: "s1", name: "Kurta shoot" }) as Shoot,
    product: async () => null,
    shootPhotos: async () => [...rows.values()],
    markSending: async (id: string) => {
      rows.get(id)!.status = "sending";
      log.push(`sending:${id}`);
    },
    saveDone: async (p: Photo) => {
      rows.get(p.id)!.status = "done";
      log.push(`done:${p.id}`);
    },
    markFailed: async (id: string, e: NonNullable<Photo["error"]>) => {
      Object.assign(rows.get(id)!, { status: "failed", error: e });
      log.push(`failed:${id}:${e.code}:${e.charged}`);
    },
    markInterrupted: async (id: string, e: NonNullable<Photo["error"]>) => {
      Object.assign(rows.get(id)!, { status: "interrupted", error: e });
      log.push(`interrupted:${id}`);
    },
    readProductPhoto: async () => png,
    readPhotoFile: async () => png,
  };
  return { store, rows, log };
}
const deps = (f: ReturnType<typeof fake>, edit: (i: unknown) => Promise<Uint8Array>, extra: object = {}) => ({
  store: f.store as never,
  catalog: {} as never,
  own: {} as never,
  openai: { editImage: edit as never },
  settings: settings(),
  emit: () => undefined,
  build: async () => ({ prompt: "p", images: [], size: "1536x1536" as const, quality: "standard" as const }),
  ...extra,
});

describe("photo queue", () => {
  it("saves `sending` before the paid request and `done` after", async () => {
    const f = fake([photo("a")]);
    const q = createQueue(
      deps(f, async () => {
        f.log.push("request");
        return png;
      }),
    );
    await q.kick();
    await q.whenIdle();
    expect(f.log).toEqual(["sending:a", "request", "done:a"]);
  });
  it("runs at most `parallel` at once", async () => {
    const f = fake([photo("a"), photo("b"), photo("c"), photo("d")]);
    let now = 0,
      peak = 0;
    const q = createQueue(
      deps(f, async () => {
        now++;
        peak = Math.max(peak, now);
        await new Promise((r) => setTimeout(r, 20));
        now--;
        return png;
      }),
    );
    await q.kick();
    await q.whenIdle();
    expect(peak).toBe(2);
    expect([...f.rows.values()].every((p) => p.status === "done")).toBe(true);
  });
  it("a refusal is failed with charged no; a lost connection is interrupted and never resent", async () => {
    const f = fake([photo("a"), photo("b")]);
    let calls = 0;
    const q = createQueue(
      deps(
        f,
        async () => {
          calls++;
          throw calls === 1 ? engineError("CONTENT_REFUSED") : engineError("INTERRUPTED", "maybe");
        },
        { settings: settings(1) },
      ),
    );
    await q.kick();
    await q.whenIdle();
    expect(f.log).toContain("failed:a:CONTENT_REFUSED:no");
    expect(f.log).toContain("interrupted:b");
    await q.kick();
    await q.whenIdle();
    expect(calls).toBe(2); // interrupted and failed photos are not picked up again
  });
  it("a job that cannot be built fails before sending, charged no", async () => {
    const f = fake([photo("a")]);
    const q = createQueue(
      deps(f, async () => png, {
        build: async () => {
          throw engineError("UNKNOWN", "no", "gone");
        },
      }),
    );
    await q.kick();
    await q.whenIdle();
    expect(f.log).toEqual(["failed:a:UNKNOWN:no"]);
  });
  it("notifies once when a whole shoot is finished, if asked", async () => {
    const f = fake([photo("a"), photo("b")]);
    const sent: string[] = [];
    const q = createQueue(deps(f, async () => png, { notify: (t: string, b: string) => void sent.push(`${t}|${b}`) }));
    await q.kick();
    await q.whenIdle();
    await new Promise((r) => setTimeout(r, 20));
    expect(sent).toEqual(["Your photos are ready|Kurta shoot: 2 photos made."]);
    const g = fake([photo("a")]);
    const quiet: string[] = [];
    const q2 = createQueue(deps(g, async () => png, { settings: settings(2, false), notify: () => void quiet.push("x") }));
    await q2.kick();
    await q2.whenIdle();
    await new Promise((r) => setTimeout(r, 20));
    expect(quiet).toEqual([]);
  });
});

describe("photo queue: money rules in the unusual cases", () => {
  it("an unexpected error after sending is failed as maybe charged, never refused", async () => {
    const f = fake([photo("a")]);
    const q = createQueue(
      deps(f, async () => {
        throw new Error("socket exploded");
      }),
    );
    await q.kick();
    await q.whenIdle();
    expect(f.log).toEqual(["sending:a", "failed:a:UNKNOWN:maybe"]);
  });
  it("a paid photo that cannot be saved is marked failed with maybe charged", async () => {
    const f = fake([photo("a")]);
    f.store.saveDone = async () => {
      throw new Error("disk full");
    };
    const q = createQueue(deps(f, async () => png));
    await q.kick();
    await q.whenIdle();
    expect(f.rows.get("a")).toMatchObject({ status: "failed", error: { charged: "maybe" } });
  });
  it("a photo already sending or interrupted is not picked up again", async () => {
    const f = fake([photo("a"), photo("b")]);
    f.rows.get("a")!.status = "sending";
    f.rows.get("b")!.status = "interrupted";
    let calls = 0;
    const q = createQueue(deps(f, async () => (calls++, png)));
    await q.kick();
    await q.whenIdle();
    expect(calls).toBe(0);
  });
  it("a notification that cannot be shown does not break the queue, and failures are counted in the words", async () => {
    const f = fake([photo("a"), photo("b")]);
    let n = 0;
    const sent: string[] = [];
    const q = createQueue(
      deps(
        f,
        async () => {
          if (++n === 2) throw engineError("CONTENT_REFUSED");
          return png;
        },
        {
          settings: settings(1),
          notify: (_t: string, body: string) => {
            sent.push(body);
            throw new Error("no permission");
          },
        },
      ),
    );
    await q.kick();
    await q.whenIdle();
    await new Promise((r) => setTimeout(r, 20));
    expect(sent).toEqual(["Kurta shoot: 1 photo made, 1 did not finish."]);
  });
  it("tells listeners about progress, and kick is safe to call again while it is busy", async () => {
    const f = fake([photo("a")]);
    const events: string[] = [];
    const q = createQueue(deps(f, async () => png, { emit: (e: { type: string; id: string }) => events.push(`${e.type}:${e.id}`) }));
    await Promise.all([q.kick(), q.kick()]);
    await q.whenIdle();
    expect(events).toContain("photo:a");
    expect(events).toContain("shoot:s1");
    expect(q.running()).toBe(0);
  });
});
