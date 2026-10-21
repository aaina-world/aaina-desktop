// What the steps need to show names and pictures for the draft's choices, loaded once per draft.
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CatalogModel,
  CatalogPose,
  CatalogScene,
  ModelRef,
  OwnModel,
  OwnPose,
  OwnScene,
  PoseRef,
  Settings,
  Shoot,
} from "../../../lib/contract";
import { framingName } from "../../../lib/labels";
import { humanize, useApi, useLoad } from "./kit";

export type ModelInfo = { ref: ModelRef; name: string; sub: string; img: string | null; age: number | null; own: boolean; sheet?: boolean };
export type PoseInfo = { name: string; img: string | null; sub: string; framing: string | null };

export function modelInfoStudio(m: CatalogModel): ModelInfo {
  return {
    ref: { source: "studio", id: m.id },
    name: m.name,
    sub: [m.age ? `${m.age}` : "", humanize(m.look)].filter(Boolean).join(" · "),
    img: m.cardUrl,
    age: m.age,
    own: false,
  };
}
export function modelInfoOwn(m: OwnModel): ModelInfo {
  const face = m.faceOptions[0]?.url ?? null;
  return {
    ref: { source: "own", id: m.id },
    name: m.name,
    sub: `${m.age}`,
    img: face ?? m.sheetUrl,
    age: m.age,
    own: true,
    sheet: !face && !!m.sheetUrl,
  };
}

export function useCreateData(shoot: Shoot | null) {
  const api = useApi();
  const conn = useLoad((a) => a.connection(), [], ["connection"]);
  const catalog = useLoad((a) => a.models(), [], ["catalog"]);
  const own = useLoad((a) => a.ownModels(), [], ["own"]);
  const scenes = useLoad((a) => a.scenes(), [], ["catalog"]);
  const ownScenes = useLoad((a) => a.ownScenes(), [], ["own"]);
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    api?.settings().then(setSettings, () => {});
  }, [api]);

  const modelKey = shoot?.model ? shoot.model.source + ":" + shoot.model.id : "";
  const poses = useLoad(
    async (a) => {
      if (!shoot?.model) return { studio: [] as CatalogPose[], own: [] as OwnPose[] };
      const [studio, mine] = await Promise.all([
        shoot.model.source === "studio" ? a.posesFor(shoot.model) : Promise.resolve([]),
        a.ownPoses(shoot.model),
      ]);
      return { studio, own: mine };
    },
    [modelKey],
    ["catalog", "own"],
  );

  const togglePin = useCallback(
    (kind: "models" | "poses" | "scenes", id: string) => {
      if (!api || !settings) return;
      const cur = settings.pins[kind];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
      const pins = { ...settings.pins, [kind]: next };
      setSettings({ ...settings, pins });
      api.updateSettings({ pins }).catch(() => setSettings(settings));
    },
    [api, settings],
  );

  const modelInfo = useMemo<ModelInfo | null>(() => {
    const r = shoot?.model;
    if (!r) return null;
    if (r.source === "own") {
      const m = own.data?.find((x) => x.id === r.id);
      return m ? modelInfoOwn(m) : { ref: r, name: "Your model", sub: "", img: null, age: null, own: true };
    }
    const m = catalog.data?.find((x) => x.id === r.id);
    return m ? modelInfoStudio(m) : { ref: r, name: "Studio model", sub: "", img: null, age: null, own: false };
  }, [shoot?.model, own.data, catalog.data]);

  const poseInfo = useCallback(
    (p: PoseRef): PoseInfo => {
      if (p.source === "words")
        return { name: p.words.length > 40 ? p.words.slice(0, 38) + "…" : p.words, img: null, sub: "Described by you", framing: null };
      if (p.source === "own") {
        const o = poses.data?.own.find((x) => x.id === p.id);
        return { name: o?.name ?? "Your pose", img: o?.imageUrl ?? null, sub: "Made by you", framing: null };
      }
      const s = poses.data?.studio.find((x) => x.id === p.id);
      return {
        name: s?.name ?? "Studio pose",
        img: s?.imageUrl ?? null,
        sub: framingName(s?.framing) ?? "Studio pose",
        framing: s?.framing ?? null,
      };
    },
    [poses.data],
  );

  const sceneInfo = useMemo(() => {
    const s = shoot?.scene;
    if (!s) return null;
    if (s.source === "colour") {
      const white = s.hex.toLowerCase() === "#ffffff";
      return {
        name: white ? "White studio" : s.name,
        sub: white ? "Plain white" : "Plain colour",
        img: null as string | null,
        colour: s.hex,
      };
    }
    if (s.source === "own") {
      const o = ownScenes.data?.find((x) => x.id === s.id);
      return { name: o?.name ?? "Your scene", sub: "Made by you", img: o?.imageUrl ?? null, colour: null };
    }
    const c = scenes.data?.find((x) => x.id === s.id);
    return { name: c?.name ?? "Studio scene", sub: c?.plain ? "Plain studio" : "Studio scene", img: c?.imageUrl ?? null, colour: null };
  }, [shoot?.scene, scenes.data, ownScenes.data]);

  return { api, conn: conn.data, catalog, own, scenes, ownScenes, settings, togglePin, modelInfo, poses, poseInfo, sceneInfo };
}
export type CreateData = ReturnType<typeof useCreateData>;
export type { CatalogScene, OwnScene };
