/** 长边上限。原图直接进 localStorage 会撑爆 5MB 配额，必须先缩。 */
const MAX_EDGE = 900;
const JPEG_QUALITY = 0.82;

/** 按长边等比缩到 MAX_EDGE 以内，输出 JPEG dataURL。 */
export async function downscaleImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2d unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
