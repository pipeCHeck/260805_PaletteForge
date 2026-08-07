export const SUPPORTED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export function isSupportedVideoFile(file) {
  if (!file || typeof file !== "object") return false;
  if (SUPPORTED_VIDEO_TYPES.has(file.type)) return true;
  return typeof file.name === "string" && /\.(mp4|webm)$/i.test(file.name);
}

export function createAnalysisTimestamps(duration, maximumSamples = 24) {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const count = Math.max(1, Math.min(maximumSamples, Math.max(4, Math.ceil(duration / 2))));
  if (count === 1) return [Math.max(0, duration / 2)];
  return Array.from({ length: count }, (_, index) => (duration * index) / (count - 1));
}

export function createCommonPaletteSettings(settings, palette, weights) {
  const next = JSON.parse(JSON.stringify(settings));
  next.colorCount = palette.length;
  next.slots = palette.map((color, index) => ({
    fixed: true,
    color: [...color],
    weight: weights[index] ?? 1,
    weightMode: "manual",
  }));
  return next;
}

export function videoOutputSpec(file) {
  const webm = file?.type === "video/webm" || /\.webm$/i.test(file?.name ?? "");
  return webm
    ? { extension: "webm", mime: "video/webm", codec: "vp9", format: "webm" }
    : { extension: "mp4", mime: "video/mp4", codec: "avc", format: "mp4" };
}

export function stagedVideoProgress(stage, progress, includesAnalysis = true) {
  const value = Math.min(1, Math.max(0, Number(progress) || 0));
  if (stage === "analysis") return Math.round(value * 20);
  if (stage === "conversion") return includesAnalysis ? Math.round(20 + value * 78) : Math.round(value * 98);
  if (stage === "finalizing") return 99;
  if (stage === "done") return 100;
  return 0;
}
