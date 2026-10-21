import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import type { Api } from "../contract";
import type { DataLayer } from "../data";
import type { Queue } from "../engine";

type Deps = {
  data: Pick<DataLayer, "settings" | "backup" | "restore" | "deleteEverything">;
  queue: Pick<Queue, "kick">;
};

export function createSettingsApi({
  data,
  queue,
}: Deps): Pick<Api, "settings" | "updateSettings" | "appVersion" | "backup" | "restore" | "deleteEverything"> {
  return {
    settings: () => data.settings.get(),
    async updateSettings(patch) {
      const next = await data.settings.update(patch);
      // More photos at once: let the queue start the extra ones now.
      if (patch.parallel) void queue.kick();
      return next;
    },
    appVersion: () => getVersion(),
    backup: (toFolder) => data.backup(toFolder),
    async restore(folder) {
      await data.restore(folder);
      await relaunch();
    },
    deleteEverything: () => data.deleteEverything(),
  };
}
