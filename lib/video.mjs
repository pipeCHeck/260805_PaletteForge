import { oklabToRgb, rgbToOklab } from "./palette.mjs";

export const SUPPORTED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
export const FRAME_PALETTE_HISTORY_LIMIT = 4;

export function isSupportedVideoFile(file) {
  if (!file || typeof file !== "object") return false;
  if (SUPPORTED_VIDEO_TYPES.has(file.type)) return true;
  return typeof file.name === "string" && /\.(mp4|webm)$/i.test(file.name);
}

export function createAnalysisTimestamps(duration, maximumSamples = 24) {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const count = Math.max(1, Math.min(maximumSamples, Math.max(4, Math.ceil(duration / 2))));
  const endTimestamp = Math.max(0, duration - Math.min(1 / 30, duration / 100));
  if (count === 1) return [endTimestamp / 2];
  return Array.from({ length: count }, (_, index) => (endTimestamp * index) / (count - 1));
}

export function videoOutputDimensions(width, height, codec) {
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  const requiresEvenDimensions = codec === "avc" || codec === "hevc";
  return {
    width: requiresEvenDimensions ? safeWidth + safeWidth % 2 : safeWidth,
    height: requiresEvenDimensions ? safeHeight + safeHeight % 2 : safeHeight,
  };
}

export function videoPaletteSummaryColor(color) {
  return color.map((value) => Math.round(Math.min(255, Math.max(0, Number(value) || 0)) / 17) * 17);
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

export function createFramePaletteSettings(settings) {
  const next = JSON.parse(JSON.stringify(settings));
  next.slots = Array.from({ length: next.colorCount }, () => ({
    fixed: false,
    color: null,
    weight: 1,
    weightMode: "auto",
  }));
  return next;
}

function oklabDistance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

function validHistoryEntries(history, colorCount) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => Array.isArray(entry?.palette) && entry.palette.length === colorCount)
    .slice(-FRAME_PALETTE_HISTORY_LIMIT);
}

function recentPaletteReference(history, colorCount) {
  const totalWeight = history.reduce((sum, _entry, index) => sum + index + 1, 0);
  return Array.from({ length: colorCount }, (_, colorIndex) => {
    const lab = [0, 0, 0];
    let weight = 0;
    history.forEach((entry, historyIndex) => {
      const recency = historyIndex + 1;
      const source = rgbToOklab(entry.palette[colorIndex]);
      lab[0] += source[0] * recency;
      lab[1] += source[1] * recency;
      lab[2] += source[2] * recency;
      weight += (entry.weights?.[colorIndex] ?? 1) * recency;
    });
    return {
      lab: lab.map((value) => value / totalWeight),
      weight: weight / totalWeight,
    };
  });
}

function matchPalette(reference, currentLabs) {
  const pairs = [];
  reference.forEach((target, referenceIndex) => {
    currentLabs.forEach((current, currentIndex) => {
      pairs.push({ referenceIndex, currentIndex, distance: oklabDistance(target.lab, current) });
    });
  });
  pairs.sort((first, second) => first.distance - second.distance || first.referenceIndex - second.referenceIndex || first.currentIndex - second.currentIndex);
  const matches = Array(reference.length).fill(null);
  const usedCurrent = new Set();
  pairs.forEach((pair) => {
    if (matches[pair.referenceIndex] !== null || usedCurrent.has(pair.currentIndex)) return;
    matches[pair.referenceIndex] = pair;
    usedCurrent.add(pair.currentIndex);
  });
  return matches;
}

export function stabilizeFramePalette(currentPalette, currentWeights = [], history = []) {
  const palette = currentPalette.map((color) => [...color]);
  const weights = palette.map((_color, index) => currentWeights[index] ?? 1);
  const recentHistory = validHistoryEntries(history, palette.length);
  if (!palette.length || !recentHistory.length) return { palette, weights, sceneCut: false, difference: 0 };

  const reference = recentPaletteReference(recentHistory, palette.length);
  const currentLabs = palette.map(rgbToOklab);
  const matches = matchPalette(reference, currentLabs);
  const distances = matches.map((match) => match.distance);
  const difference = distances.reduce((sum, value) => sum + value, 0) / distances.length;
  const changedRatio = distances.filter((value) => value >= 0.14).length / distances.length;
  const sceneCut = difference >= 0.18 || (difference >= 0.12 && changedRatio >= 0.5);
  if (sceneCut) return { palette, weights, sceneCut: true, difference };

  const usedColors = new Set();
  const stabilizedPalette = matches.map((match, index) => {
    const current = currentLabs[match.currentIndex];
    const target = reference[index].lab;
    const blended = oklabToRgb([
      current[0] * 0.65 + target[0] * 0.35,
      current[1] * 0.65 + target[1] * 0.35,
      current[2] * 0.65 + target[2] * 0.35,
    ]);
    let candidate = blended;
    let key = candidate.join(",");
    if (usedColors.has(key)) {
      candidate = palette[match.currentIndex];
      key = candidate.join(",");
    }
    usedColors.add(key);
    return candidate;
  });
  const stabilizedWeights = matches.map((match, index) => {
    const current = weights[match.currentIndex];
    return Math.round(Math.min(5, Math.max(0.1, current * 0.7 + reference[index].weight * 0.3)) * 100) / 100;
  });
  return { palette: stabilizedPalette, weights: stabilizedWeights, sceneCut: false, difference };
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

export function formatVideoElapsedTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const minuteLabel = String(minutes).padStart(2, "0");
  const secondLabel = String(remainingSeconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${minuteLabel}:${secondLabel}` : `${minuteLabel}:${secondLabel}`;
}
