// The photo queue. Money rules (ARCHITECTURE.md): the row is saved as `sending` BEFORE the paid request; a `sending` or
// `interrupted` photo is never sent again by the queue; a refused photo is failed with charged "no".
import type { Photo, Settings } from "../contract";
import { MESSAGES, isEngineError } from "./errors";
import { buildJob, type Job, type JobDeps } from "./jobs";
import { pngSize } from "./images";
import type { OpenAI } from "./openai";

export type QueueEvent = { type: "photo" | "shoot"; id: string };

export type QueueDeps = JobDeps & {
  openai: Pick<OpenAI, "editImage">;
  settings: () => Promise<Settings>;
  emit: (event: QueueEvent) => void;
  /** A desktop notification (permission handled by the caller). */
  notify?: (title: string, body: string) => Promise<void> | void;
  /** Test hook: replaces building a job. */
  build?: (photo: Photo) => Promise<Job>;
};

export function createQueue(deps: QueueDeps) {
  const { store, openai } = deps;
  const running = new Set<string>();
  const shootsInRun = new Set<string>();
  let kicking = false;
  let again = false;

  const failure = (code: keyof typeof MESSAGES, charged: "no" | "maybe", message = MESSAGES[code]) => ({ code, message, charged });

  async function finishShootIfDone(shootId: string): Promise<void> {
    if (!shootsInRun.has(shootId)) return;
    const all = await store.shootPhotos(shootId);
    if (all.some((p) => p.status === "queued" || p.status === "sending")) return;
    if (!shootsInRun.delete(shootId)) return; // another photo of this shoot already reported it
    deps.emit({ type: "shoot", id: shootId });
    const settings = await deps.settings();
    if (!settings.notifyWhenReady || !deps.notify) return;
    const shoot = await store.shoot(shootId);
    const done = all.filter((p) => p.status === "done").length;
    const failed = all.length - done;
    try {
      await deps.notify(
        "Your photos are ready",
        `${shoot?.name ?? "Your shoot"}: ${done} ${done === 1 ? "photo" : "photos"} made${failed ? `, ${failed} did not finish` : ""}.`,
      );
    } catch {
      /* a notification that cannot be shown is not an error */
    }
  }

  async function runOne(photo: Photo): Promise<void> {
    let sent = false;
    try {
      const job = await (deps.build ? deps.build(photo) : buildJob(photo, deps));
      // From here the request may be charged: the row is saved as `sending` first.
      await store.markSending(photo.id);
      sent = true;
      deps.emit({ type: "photo", id: photo.id });
      const png = await openai.editImage({ prompt: job.prompt, images: job.images, size: job.size, quality: job.quality });
      const size = pngSize(png) ?? { width: 1536, height: 1536 };
      const shoot = (await store.shoot(photo.shootId))!;
      await store.saveDone(photo, shoot, png, size);
    } catch (e) {
      const err = isEngineError(e) ? e : null;
      const code = err?.code ?? "UNKNOWN";
      const charged = err ? err.charged : sent ? "maybe" : "no";
      const detail = failure(code, charged, err?.message ?? MESSAGES.UNKNOWN);
      // A failure to save the finished photo after it was paid for is also "maybe charged"; the row must not look refused.
      if (code === "INTERRUPTED") await store.markInterrupted(photo.id, detail);
      else await store.markFailed(photo.id, detail);
    } finally {
      running.delete(photo.id);
      deps.emit({ type: "photo", id: photo.id });
      await finishShootIfDone(photo.shootId).catch(() => undefined);
      void kick();
    }
  }

  /** Starts as many queued photos as `settings.parallel` allows. Safe to call any time. */
  async function kick(): Promise<void> {
    if (kicking) {
      again = true;
      return;
    }
    kicking = true;
    try {
      do {
        again = false;
        const free = (await deps.settings()).parallel - running.size;
        if (free <= 0) continue;
        const next = (await store.queued(free + running.size)).filter((p) => !running.has(p.id)).slice(0, free);
        for (const photo of next) {
          running.add(photo.id);
          shootsInRun.add(photo.shootId);
          void runOne(photo);
        }
      } while (again);
    } finally {
      kicking = false;
    }
  }

  /** Resolves when nothing is running (tests). */
  const whenIdle = () =>
    new Promise<void>((resolve) => {
      const t = setInterval(() => {
        if (!running.size && !kicking) {
          clearInterval(t);
          resolve();
        }
      }, 5);
    });

  return { kick, whenIdle, running: () => running.size };
}
export type Queue = ReturnType<typeof createQueue>;
