import sharp from "sharp";
import path from "path";

const LOGO_PATH = path.join(process.cwd(), "public", "watermark-logo.png");
const WATERMARK_OPACITY = 0.30;

export async function applyWatermark(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const { width = 1920, height = 1080 } = await image.metadata();

  // Normally size to 90% of the shorter side (a clean, fully-visible circle
  // on typical landscape/portrait/square photos). But never smaller than 60%
  // of the LONGER side — on an extreme wide panorama or tall vertical crop
  // that keeps the mark big enough to stay dominant, even if it means the
  // circle bleeds past the shorter edges (cropped below) instead of shrinking
  // into a small, easy-to-crop-around badge.
  const minDim = Math.min(width, height);
  const maxOfWH = Math.max(width, height);
  const maxDim = Math.round(Math.max(minDim * 0.90, maxOfWH * 0.60));

  const { data, info } = await sharp(LOGO_PATH)
    .resize(maxDim, maxDim, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Scale only the alpha channel to the target opacity. Scaling all four
  // channels (e.g. via .linear()) darkens the white logo to grey instead of
  // making it translucent.
  const pixels = Buffer.from(data);
  for (let i = 3; i < pixels.length; i += 4) {
    pixels[i] = Math.round(pixels[i] * WATERMARK_OPACITY);
  }

  let logoSharp = sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
  let logoW = info.width;
  let logoH = info.height;

  // sharp's composite() requires the overlay to fit within the base canvas —
  // when the hybrid sizing above makes the logo bigger than the photo in
  // either dimension, crop it (centered) down to the photo's bounds first.
  if (logoW > width || logoH > height) {
    const cropW = Math.min(logoW, width);
    const cropH = Math.min(logoH, height);
    logoSharp = logoSharp.extract({
      left: Math.round((logoW - cropW) / 2),
      top: Math.round((logoH - cropH) / 2),
      width: cropW,
      height: cropH,
    });
    logoW = cropW;
    logoH = cropH;
  }

  const logo = await logoSharp.png().toBuffer();
  const left = Math.round((width - logoW) / 2);
  const top = Math.round((height - logoH) / 2);

  return image
    .composite([{ input: logo, left, top, blend: "over" }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
