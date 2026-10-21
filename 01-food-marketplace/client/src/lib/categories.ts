export { CATEGORIES, UNITS } from "../api/types";

export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
