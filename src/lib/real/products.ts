import { POSE_CATEGORIES } from "../catalog/poseTaxonomy";
import type { Api, PhotoRole, Product } from "../contract";
import type { DataLayer } from "../data";
import type { Works } from "../engine";
import type { Emit } from "./events";

const PRODUCT_TYPES = Object.keys(POSE_CATEGORIES);
const TYPE_NAMES = Object.entries(POSE_CATEGORIES).map(([id, category]): [string, string] => [id, category.label]);
const ROLE_ORDER: Record<PhotoRole, number> = { front: 0, back: 1, detail: 2 };
/** The reading looks at the front, then the back, then a detail: three photos are enough. */
const PHOTOS_READ = 3;

const stripExtension = (name: string) => name.replace(/\.[a-z0-9]+$/i, "");

type Deps = {
  data: Pick<DataLayer, "products" | "photos" | "files">;
  works: Pick<Works, "readProduct">;
  emit: Emit;
};

export function createProductsApi({
  data,
  works,
  emit,
}: Deps): Pick<Api, "products" | "product" | "createProduct" | "updateProduct" | "addProductPhotos" | "deleteProduct" | "readProduct"> {
  async function existing(id: string): Promise<Product> {
    const product = await data.products.get(id);
    if (!product) throw new Error("That product is gone.");
    return product;
  }

  async function importPhotos(productId: string, files: { path: string; role: PhotoRole }[]): Promise<void> {
    for (const file of files) {
      const image = await data.files.importProductPhoto(file.path, productId);
      await data.products.addPhoto({ productId, path: image.path, role: file.role, width: image.width, height: image.height });
    }
  }

  return {
    products: () => data.products.list(),
    product: (id) => data.products.get(id),
    async createProduct(files, name) {
      if (!files.length) throw new Error("Add at least one photo.");
      const fallback = stripExtension(data.files.baseNameOf(files[0].path)) || "Product";
      const id = await data.products.create({ name: name?.trim() || fallback });
      await importPhotos(id, files);
      return existing(id);
    },
    async updateProduct(id, patch) {
      if (patch.name !== undefined) await data.products.rename(id, patch.name.trim() || "Product");
      if (patch.reading !== undefined) await data.products.setReading(id, patch.reading);
      for (const photo of patch.photos ?? []) await data.products.setPhotoRole(photo.id, photo.role);
      emit({ type: "shoot" }); // shoots show their product's name and photos
      return existing(id);
    },
    async addProductPhotos(id, files) {
      await importPhotos(id, files);
      emit({ type: "shoot" });
      return existing(id);
    },
    async deleteProduct(id) {
      const photoFiles = await data.photos.filesOf("product", id);
      const productFiles = await data.products.photoPaths(id);
      await data.products.remove(id);
      for (const file of photoFiles) await data.files.removePhotoFile(file.root, file.path);
      for (const path of productFiles) await data.files.removeApp(path);
      emit({ type: "shoot" });
    },
    async readProduct(id) {
      const product = await data.products.get(id);
      if (!product?.photos.length) throw new Error("This product has no photos.");
      const ordered = [...product.photos].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
      const bytes = await Promise.all(ordered.slice(0, PHOTOS_READ).map((photo) => data.files.readAppFile(photo.path)));
      const reading = await works.readProduct(bytes, { productTypes: PRODUCT_TYPES, typeNames: TYPE_NAMES, productName: product.name });
      await data.products.setReading(id, reading);
      emit({ type: "shoot" });
      return reading;
    },
  };
}
