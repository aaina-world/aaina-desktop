import { IMG } from "./images";
import type { CatalogModel, CatalogPose, CatalogScene, Gender } from "../contract";

const m = (
  id: string,
  name: string,
  gender: Gender,
  age: number,
  look: string,
  body: string,
  appearance: string,
  img: string,
  extra: Partial<CatalogModel> = {},
): CatalogModel => ({
  id,
  name,
  gender,
  ageGroup: "adult",
  age,
  look,
  body,
  tags: [],
  appearance,
  minor: false,
  cardUrl: img,
  faceUrl: img,
  sheetUrl: null,
  photoUrls: [img],
  poolKey: null,
  suits: null,
  ...extra,
});

export const MODELS: CatalogModel[] = [
  m("tara", "Tara", "woman", 26, "South Asian", "average", "young Indian woman, age 26, with long straight black hair", IMG.modelTara, {
    sheetUrl: IMG.sheetSample,
    tags: ["supermodel"],
  }),
  m("chloe", "Chloe", "woman", 24, "European", "slim", "young woman, age 24, with a light brown bob", IMG.modelChloe, {
    sheetUrl: IMG.sheetSample,
  }),
  m("nia", "Nia", "woman", 29, "Black", "average", "woman, age 29, with short natural hair", IMG.modelNia, { sheetUrl: IMG.sheetSample }),
  m("camille", "Camille", "woman", 31, "European", "slim", "woman, age 31, with wavy chestnut hair", IMG.modelCamille),
  m("aaina", "Aaina", "woman", 25, "South Asian", "average", "young Indian woman, age 25, with shoulder-length wavy hair", IMG.modelAaina, {
    tags: ["supermodel"],
  }),
  m("kabir", "Kabir", "man", 28, "South Asian", "athletic", "Indian man, age 28, short dark hair and a trimmed beard", IMG.modelKabir, {
    sheetUrl: IMG.sheetSample,
  }),
  m("ansh", "Ansh", "man", 27, "South Asian", "average", "Indian man, age 27, short black hair", IMG.modelAnsh),
  m("ethan", "Ethan", "man", 30, "European", "athletic", "man, age 30, short blond hair", IMG.modelEthan),
  m("luca", "Luca", "man", 26, "European", "slim", "man, age 26, dark curly hair", IMG.modelLuca),
  m("malik", "Malik", "man", 33, "Black", "athletic", "man, age 33, close-cropped hair", IMG.modelMalik),
  m("marco", "Marco", "man", 35, "European", "average", "man, age 35, short grey-flecked hair", IMG.modelMarco),
  m("matteo", "Matteo", "man", 24, "European", "slim", "young man, age 24, tousled brown hair", IMG.modelMatteo),
  m("rehan", "Rehan", "man", 29, "South Asian", "average", "man, age 29, medium-length dark hair", IMG.modelRehan),
];

const POSE_NAMES = [
  "Arms crossed, wide stance",
  "Asymmetric stance",
  "One shoulder drop",
  "Peace sign",
  "Walking, hand in pocket",
  "Seated, leaning forward",
  "Over the shoulder",
  "True rear",
  "Hands in pockets",
  "Looking down, soft smile",
  "Leaning on the wall",
  "Adjusting the collar",
  "Full stride",
  "Arms relaxed, front",
  "Turning away",
  "Sitting on a stool",
];
const POSE_IMGS = [
  IMG.pose1,
  IMG.pose2,
  IMG.pose3,
  IMG.pose4,
  IMG.pose5,
  IMG.pose6,
  IMG.pose7,
  IMG.pose8,
  IMG.pose9,
  IMG.pose10,
  IMG.pose11,
  IMG.pose12,
  IMG.pose13,
  IMG.pose14,
  IMG.pose15,
  IMG.pose16,
];

export function posesOf(modelId: string): CatalogPose[] {
  return POSE_NAMES.map((name, i) => ({
    id: `${modelId}-pose-${i + 1}`,
    name,
    imageUrl: POSE_IMGS[i],
    modelId,
    shownOn: null,
    best: i % 3 === 0 ? ["crewneck_tshirts", "shirts"] : ["jackets", "coats"],
    also: ["dresses"],
    style: ["catalogue"],
    framing: i === 9 ? "waist-up" : "full-length",
  }));
}

const sc = (id: string, name: string, imageUrl: string, extra: Partial<CatalogScene> = {}): CatalogScene => ({
  id,
  name,
  imageUrl,
  bestFor: ["crewneck_tshirts"],
  also: [],
  style: ["catalogue"],
  region: null,
  plain: false,
  ...extra,
});
export const SCENES: CatalogScene[] = [
  sc("plain-grey", "Plain grey", IMG.sceneArtGalleryMatte, { plain: true }),
  sc("plaster-arches", "Plaster arches", IMG.sceneArchedArcadePoolside, { region: "Mediterranean" }),
  sc("accra-courtyard", "Accra courtyard", IMG.sceneAccraCourtyard, { region: "Africa" }),
  sc("mural-alley", "Mural alley", IMG.sceneAlleyMuralBikeRail, { style: ["streetwear"] }),
  sc("amsterdam-canal", "Amsterdam canal", IMG.sceneAmsterdamCanalSide, { region: "Europe" }),
  sc("dunes-dawn", "Dunes at dawn", IMG.sceneArabianDunesDawn, { region: "Middle East" }),
  sc("limewash-hall", "Limewash hall", IMG.sceneArchedShelfLimewashHall),
  sc("artist-studio", "Artist studio", IMG.sceneArtistStudioEaselDaylight),
  sc("beach-house", "Beach house", IMG.sceneAustralianBeachHouse, { region: "Australia" }),
  sc("autumn-park", "Autumn park path", IMG.sceneAutumnParkPathSquare),
  sc("bakery-window", "Bakery window", IMG.sceneBakeryWindowPavement),
  sc("bali-villa", "Bali villa", IMG.sceneBaliVilla, { region: "South-East Asia" }),
];

export const MODEL_RESULTS = [
  IMG.realOnmodel,
  IMG.realAaina,
  IMG.realAnsh,
  IMG.modelChloeP,
  IMG.startChloe,
  IMG.startPhotoshoot,
  IMG.startPicture,
  IMG.modelTaraP,
  IMG.modelNiaP,
  IMG.realPoster,
];
export const GHOST_RESULTS = [IMG.ghostFront, IMG.ghostSide, IMG.ghostBack, IMG.realGhost, IMG.realGhost];
export const FLAT_RESULTS = [IMG.flatlayClean, IMG.flatlayFolded, IMG.flatlayStyled, IMG.realFlatlay];
export const POSE_TITLES = POSE_NAMES;
export const FACE_OPTIONS = [IMG.modelNiaP, IMG.modelTaraP, IMG.modelChloeP];
