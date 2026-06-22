import sharp from "sharp";
import path from "path";

const LOGO_PATH = path.join(process.cwd(), "public", "watermark-logo.png");

export async function applyWatermark(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const { width = 1920, height = 1080 } = await image.metadata();

  // Scale logo to fill most of the image (fit inside, 90% of shortest dimension), center it at 10% opacity
  const maxDim = Math.round(Math.min(width, height) * 0.90);
  const logo = await sharp(LOGO_PATH)
    .resize(maxDim, maxDim, { fit: "inside" })
    .ensureAlpha()
    .linear(0.20, 0)
    .toBuffer();

  const logoMeta = await sharp(logo).metadata();
  const logoW = logoMeta.width ?? maxDim;
  const logoH = logoMeta.height ?? maxDim;
  const left = Math.round((width - logoW) / 2);
  const top = Math.round((height - logoH) / 2);

  const composites: sharp.OverlayOptions[] = [
    { input: logo, left, top, blend: "screen" },
  ];

  return image
    .composite(composites)
    .jpeg({ quality: 88 })
    .toBuffer();
}
