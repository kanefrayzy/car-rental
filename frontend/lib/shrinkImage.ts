/**
 * Phone photos and screenshots are often 5-10 MB. On a weak mobile connection such an upload
 * stalls and the phone drops it (a customer's 8 MB upload died after 57 seconds, 2026-10-16).
 * Photos over SHRINK_FROM_BYTES are redrawn in the browser at most MAX_SIDE pixels on the long
 * side and saved as JPEG: still sharp enough to read a license, usually under 1 MB.
 * PDFs, small files and anything the browser cannot decode go up as they are.
 */
const MAX_SIDE = 2400;
const QUALITY = 0.85;
const SHRINK_FROM_BYTES = 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function shrinkImage(file: File): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type) || file.size <= SHRINK_FROM_BYTES) return file;

  try {
    // EXIF orientation is applied, so a portrait photo stays upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG has no transparency: a transparent PNG would turn black without this.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
