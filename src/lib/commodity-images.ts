// Commodity artwork. Bundled images are keyed by commodity slug so the
// database never has to store asset URLs. Falls back to the stored image_url.
import localRice from "@/assets/commodities/local-rice.jpg";
import whiteMaize from "@/assets/commodities/white-maize.jpg";
import cocoa from "@/assets/commodities/cocoa.jpg";

export const commodityImages: Record<string, string> = {
  "local-rice": localRice,
  "white-maize": whiteMaize,
  cocoa: cocoa,
};

export function commodityImage(slug: string, imageUrl: string | null): string | null {
  return commodityImages[slug] ?? imageUrl ?? null;
}
