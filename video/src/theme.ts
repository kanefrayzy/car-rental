import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadDmSans } from "@remotion/google-fonts/DMSans";
import { useVideoConfig } from "remotion";

// The site's tokens (frontend/app/globals.css) and fonts.
export const color = {
  brand: "#0a7aff",
  brandDeep: "#0566fb",
  ink: "#0a1730",
  navy: "#0f2035",
  navySoft: "#18385c",
  night: "#050b16",
  white: "#ffffff",
  sky: "#a9cbea",
};

const jakarta = loadJakarta("normal", { weights: ["600", "800"], subsets: ["latin"] });
loadJakarta("italic", { weights: ["800"], subsets: ["latin"] });
const dmSans = loadDmSans("normal", { weights: ["500", "700"], subsets: ["latin"] });

export const font = {
  display: jakarta.fontFamily,
  body: dmSans.fontFamily,
};

/** Frame shape. Sizes are in pixels of a 1080-wide (portrait) or 1080-high (landscape) frame. */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  return { width, height, portrait };
};
