export type Point = { x: number; y: number };
export type Region = { x: number; y: number; width: number; height: number };
export type RegionStats = {
  region: Region;
  pixels: number;
  mean: { r: number; g: number; b: number; brightness: number };
  histogram: number[];
  threshold: number;
  aboveThreshold: number;
  abovePercent: number;
};
export type ImageAnalysisRecord = {
  id: string;
  title: string;
  created_at: string;
  filename: string;
  sha256: string;
  width: number;
  height: number;
  notes: string;
  a: RegionStats;
  b: RegionStats | null;
  calibration: { points: [Point, Point]; length: number; unit: string } | null;
  measurement: {
    points: [Point, Point];
    pixels: number;
    length: number | null;
    unit: string;
  } | null;
  method: string;
};
export const IMAGE_METHOD =
  'RGB 0–255, alpha composited on white; brightness=0.2126R+0.7152G+0.0722B on encoded sRGB (not calibrated luminance). Threshold includes equality. Rectangle bounds: floor start, ceil end, clamped to image. Distances use original-image pixel coordinates; calibration assumes uniform scale in one plane.';
export function regionBetween(
  a: Point,
  b: Point,
  width: number,
  height: number,
): Region {
  const x = Math.max(0, Math.min(width, Math.floor(Math.min(a.x, b.x))));
  const y = Math.max(0, Math.min(height, Math.floor(Math.min(a.y, b.y))));
  const endX = Math.max(0, Math.min(width, Math.ceil(Math.max(a.x, b.x))));
  const endY = Math.max(0, Math.min(height, Math.ceil(Math.max(a.y, b.y))));
  return { x, y, width: endX - x, height: endY - y };
}
export function analyzeRegion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  region: Region,
  threshold: number,
): RegionStats {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    data.length !== width * height * 4
  )
    throw new Error('이미지 크기와 픽셀 데이터가 일치하지 않습니다.');
  if (
    ![region.x, region.y, region.width, region.height].every(
      Number.isInteger,
    ) ||
    region.width < 1 ||
    region.height < 1 ||
    region.x < 0 ||
    region.y < 0 ||
    region.x + region.width > width ||
    region.y + region.height > height
  )
    throw new Error('분석 영역이 이미지 범위를 벗어났거나 비어 있습니다.');
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255)
    throw new Error('밝기 기준은 0~255여야 합니다.');
  let r = 0,
    g = 0,
    b = 0,
    brightness = 0,
    aboveThreshold = 0;
  const histogram = Array<number>(256).fill(0);
  for (let y = region.y; y < region.y + region.height; y++)
    for (let x = region.x; x < region.x + region.width; x++) {
      const i = (y * width + x) * 4,
        alpha = data[i + 3] / 255;
      const red = data[i] * alpha + 255 * (1 - alpha),
        green = data[i + 1] * alpha + 255 * (1 - alpha),
        blue = data[i + 2] * alpha + 255 * (1 - alpha);
      // Equivalent weights, while preserving exact neutral gray (including 255).
      const value = green + 0.2126 * (red - green) + 0.0722 * (blue - green);
      r += red;
      g += green;
      b += blue;
      brightness += value;
      histogram[Math.round(value)]++;
      if (value >= threshold) aboveThreshold++;
    }
  const pixels = region.width * region.height;
  return {
    region,
    pixels,
    mean: {
      r: r / pixels,
      g: g / pixels,
      b: b / pixels,
      brightness: brightness / pixels,
    },
    histogram,
    threshold,
    aboveThreshold,
    abovePercent: (aboveThreshold / pixels) * 100,
  };
}
export const pixelDistance = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.y - a.y);
export function calibratedLength(
  pixels: number,
  referencePixels: number,
  referenceLength: number,
): number | null {
  return [pixels, referencePixels, referenceLength].every(Number.isFinite) &&
    pixels >= 0 &&
    referencePixels > 0 &&
    referenceLength > 0
    ? (pixels / referencePixels) * referenceLength
    : null;
}
export function compareRegions(a: RegionStats, b: RegionStats) {
  const difference = b.mean.brightness - a.mean.brightness;
  return {
    brightnessDifference: difference,
    relativePercent:
      a.mean.brightness === 0 ? null : (difference / a.mean.brightness) * 100,
    areaPercentPointDifference: b.abovePercent - a.abovePercent,
  };
}
