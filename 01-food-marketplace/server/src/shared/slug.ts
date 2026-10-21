import slugify from "slugify";
import { Store } from "../modules/stores/store.model.js";

export async function uniqueStoreSlug(name: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true, trim: true }) || "shop";
  let candidate = base;
  let counter = 2;
  while (await Store.exists({ slug: candidate })) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}
