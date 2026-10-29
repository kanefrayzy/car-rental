import imageWidths from "@/config/image-widths.json";

/**
 * next/image loader for images resized in advance by scripts/images.mjs. Picks the smallest
 * prepared width that covers the requested one; the largest is the original file. Nothing is
 * resized on the server: the production server's CPU cannot run sharp, which Next's own
 * optimizer needs. An image not in the list is served as it is.
 *
 * Blog pictures (covers and pictures inside posts) come from the API's public disk with their
 * size in the name, "…/storage/blog/covers/k3j…_1600x900.webp", and copies 480, 800 and 1200 px
 * wide next to them where the picture is wider (backend: app/Services/BlogImages.php).
 */
const widths: Record<string, number[]> = imageWidths;

const BLOG_IMAGE = /\/storage\/blog\/(?:covers|images)\/[a-z0-9]+_(\d+)x(\d+)\.webp$/;
const BLOG_COPY_WIDTHS = [480, 800, 1200];

/** Width and height of a blog picture, read from its name; null for any other image. */
export function blogImageSize(src: string): { width: number; height: number } | null {
  const match = BLOG_IMAGE.exec(src);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  const blog = blogImageSize(src);
  if (blog) {
    const copy = BLOG_COPY_WIDTHS.find((candidate) => candidate < blog.width && candidate >= width);
    return copy ? src.replace(/\.webp$/, `-${copy}.webp`) : src;
  }

  const available = widths[src];
  if (!available) return src;

  const largest = available[available.length - 1];
  const pick = available.find((candidate) => candidate >= width) ?? largest;
  if (pick === largest) return src;

  return src.replace(/^\/images\//, "/images/w/").replace(/\.webp$/, `-${pick}.webp`);
}
