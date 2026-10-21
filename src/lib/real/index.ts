// The real Api: the data layer (SQLite, files, keychain), the catalogue and the photo engine put together.
// Each part is a small module that gets what it needs explicitly; this file only wires them.
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import type { Api } from "../contract";
import { createCatalog } from "../catalog";
import { createDataLayer } from "../data";
import { createQueue, createWorks } from "../engine";
import type { JsonReader } from "../engine";
import { createCatalogApi } from "./catalog";
import { createConnection } from "./connection";
import { createEvents } from "./events";
import { createFilesApi } from "./files";
import { createOwnApi } from "./own";
import { createProductsApi } from "./products";
import { createSettingsApi } from "./settings";
import { createShootsApi } from "./shoots";
import { createSources } from "./sources";
import { createEngineStore } from "./store";

async function notify(title: string, body: string): Promise<void> {
  const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
  if (granted) sendNotification({ title, body });
}

export async function createApi(): Promise<Api> {
  const data = await createDataLayer();
  const catalog = await createCatalog(data);
  // Start loading the studio catalogue as the app opens, so models are ready before anyone asks for them.
  void catalog.models().catch(() => undefined);
  const events = createEvents();
  const { emit } = events;

  const connection = createConnection({ secrets: data.secrets, emit });
  const { openai, chatgpt, getKey, requireKey } = connection;
  const works = createWorks(openai, {
    keyPresent: async () => !!(await getKey()),
    chatgptReader: async (): Promise<JsonReader | null> =>
      (await chatgpt.signedIn()) ? (input) => chatgpt.readJson({ prompt: input.prompt, images: input.images }) : null,
  });

  const store = createEngineStore(data);
  const sources = createSources({ catalog, data });
  const queue = createQueue({
    store,
    catalog: sources.catalogSource,
    own: sources.ownSource,
    openai,
    settings: () => data.settings.get(),
    emit,
    notify,
  });

  const api: Api = {
    ...createCatalogApi({ catalog, data, sources }),
    ...createProductsApi({ data, works, emit }),
    ...createShootsApi({ data, queue, sources, requireKey, emit }),
    ...createOwnApi({ data, works, sources, requireKey, emit }),
    ...createFilesApi({ data, readPhotoFile: (photo) => store.readPhotoFile(photo) }),
    ...connection.api,
    ...createSettingsApi({ data, queue }),
    subscribe: events.subscribe,
  };

  catalog.subscribe(() => emit({ type: "catalog" }));
  void queue.kick(); // photos still queued from last time carry on; anything that was `sending` is already `interrupted` and stays so
  return api;
}
