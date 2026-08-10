import { defaultSettings, normalizeSlotCount, oklabToRgb, rgbToOklab } from "./palette.mjs";

export const SUPPORTED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
export const FRAME_SCENE_COOLDOWN = 3;

export function createDefaultVideoSettings() {
  const settings = defaultSettings();
  settings.colorCount = 16;
  settings.surfaceCleanup = 0;
  return normalizeSlotCount(settings);
}

export function estimateVideoWorkload({ width, height, duration, fileSize, deviceMemory } = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const safeDuration = Math.max(0, Number(duration) || 0);
  const safeFileSize = Math.max(0, Number(fileSize) || 0);
  const memory = Number.isFinite(Number(deviceMemory)) && Number(deviceMemory) > 0 ? Number(deviceMemory) : null;
  const megapixels = safeWidth * safeHeight / 1_000_000;
  const pixelSeconds = megapixels * safeDuration;
  const fileMegabytes = safeFileSize / (1024 * 1024);
  const factors = [];
  let score = 0;

  if (megapixels >= 8) { score += 3; factors.push("고해상도"); }
  else if (megapixels >= 4) { score += 2; factors.push("고해상도"); }
  else if (megapixels >= 2.5) score += 1;

  if (safeDuration >= 1_200) { score += 4; factors.push("긴 재생시간"); }
  else if (safeDuration >= 600) { score += 3; factors.push("긴 재생시간"); }
  else if (safeDuration >= 180) { score += 2; factors.push("긴 재생시간"); }
  else if (safeDuration >= 60) score += 1;

  if (fileMegabytes >= 750) { score += 6; factors.push("큰 파일"); }
  else if (fileMegabytes >= 500) { score += 4; factors.push("큰 파일"); }
  else if (fileMegabytes >= 200) { score += 2; factors.push("큰 파일"); }
  else if (fileMegabytes >= 100) score += 1;

  if (pixelSeconds >= 3_000) score += 4;
  else if (pixelSeconds >= 1_200) score += 3;
  else if (pixelSeconds >= 500) score += 2;
  else if (pixelSeconds >= 200) score += 1;

  if (memory !== null && memory <= 4) { score += 2; factors.push("제한적인 기기 메모리"); }
  else if (memory !== null && memory <= 8) score += 1;
  else if (memory !== null && memory >= 16) score = Math.max(0, score - 1);

  return {
    level: score >= 8 ? "risk" : score >= 4 ? "caution" : "smooth",
    score,
    factors: [...new Set(factors)],
    megapixels,
    fileMegabytes,
    deviceMemory: memory,
  };
}

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

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function normalizedHistogram(histogram, total) {
  if (total <= 0) return histogram;
  return histogram.map((value) => value / total);
}

export function createFrameSignature(pixels, width, height) {
  const safeWidth = Math.max(1, Math.floor(Number(width) || 1));
  const safeHeight = Math.max(1, Math.floor(Number(height) || 1));
  const sampleWidth = Math.min(64, safeWidth);
  const sampleHeight = Math.min(36, safeHeight);
  const thumbnailWidth = 12;
  const thumbnailHeight = 7;
  const chromaHistogram = Array(64).fill(0);
  const lumaHistogram = Array(16).fill(0);
  const thumbnail = Array.from({ length: thumbnailWidth * thumbnailHeight }, () => [0, 0, 0]);
  const thumbnailWeight = Array(thumbnail.length).fill(0);
  const thumbnailSamples = Array(thumbnail.length).fill(0);
  let visibleWeight = 0;
  let lumaTotal = 0;

  for (let sampleY = 0; sampleY < sampleHeight; sampleY += 1) {
    const y = Math.min(safeHeight - 1, Math.floor((sampleY + 0.5) * safeHeight / sampleHeight));
    const thumbnailY = Math.min(thumbnailHeight - 1, Math.floor(sampleY * thumbnailHeight / sampleHeight));
    for (let sampleX = 0; sampleX < sampleWidth; sampleX += 1) {
      const x = Math.min(safeWidth - 1, Math.floor((sampleX + 0.5) * safeWidth / sampleWidth));
      const thumbnailX = Math.min(thumbnailWidth - 1, Math.floor(sampleX * thumbnailWidth / sampleWidth));
      const thumbnailIndex = thumbnailY * thumbnailWidth + thumbnailX;
      thumbnailSamples[thumbnailIndex] += 1;
      const pixelIndex = (y * safeWidth + x) * 4;
      const alpha = (pixels[pixelIndex + 3] ?? 0) / 255;
      if (alpha <= 0) continue;
      const lab = rgbToOklab([pixels[pixelIndex], pixels[pixelIndex + 1], pixels[pixelIndex + 2]]);
      const aBin = Math.min(7, Math.max(0, Math.floor((lab[1] + 0.4) / 0.8 * 8)));
      const bBin = Math.min(7, Math.max(0, Math.floor((lab[2] + 0.4) / 0.8 * 8)));
      const lumaBin = Math.min(15, Math.max(0, Math.floor(lab[0] * 16)));
      chromaHistogram[aBin * 8 + bBin] += alpha;
      lumaHistogram[lumaBin] += alpha;
      thumbnail[thumbnailIndex][0] += lab[0] * alpha;
      thumbnail[thumbnailIndex][1] += lab[1] * alpha;
      thumbnail[thumbnailIndex][2] += lab[2] * alpha;
      thumbnailWeight[thumbnailIndex] += alpha;
      visibleWeight += alpha;
      lumaTotal += lab[0] * alpha;
    }
  }

  return {
    chromaHistogram: normalizedHistogram(chromaHistogram, visibleWeight),
    lumaHistogram: normalizedHistogram(lumaHistogram, visibleWeight),
    thumbnail: thumbnail.map((lab, index) => thumbnailWeight[index] > 0 ? lab.map((value) => value / thumbnailWeight[index]) : [0, 0, 0]),
    thumbnailAlpha: thumbnailWeight.map((value, index) => thumbnailSamples[index] > 0 ? value / thumbnailSamples[index] : 0),
    averageLuma: visibleWeight > 0 ? lumaTotal / visibleWeight : 0,
    visibleRatio: visibleWeight / (sampleWidth * sampleHeight),
  };
}

function histogramDifference(first = [], second = []) {
  const length = Math.max(first.length, second.length);
  let difference = 0;
  for (let index = 0; index < length; index += 1) difference += Math.abs((first[index] ?? 0) - (second[index] ?? 0));
  return clamp01(difference / 2);
}

export function compareFrameSignatures(previous, current) {
  if (!previous || !current) {
    return { difference: 0, chroma: 0, luma: 0, spatialChroma: 0, spatialLuma: 0, visibility: 0, flash: false };
  }
  const chroma = histogramDifference(previous.chromaHistogram, current.chromaHistogram);
  const luma = histogramDifference(previous.lumaHistogram, current.lumaHistogram);
  const cellCount = Math.max(previous.thumbnail?.length ?? 0, current.thumbnail?.length ?? 0);
  let spatialChromaTotal = 0;
  let spatialLumaTotal = 0;
  let spatialWeight = 0;
  for (let index = 0; index < cellCount; index += 1) {
    const previousAlpha = previous.thumbnailAlpha?.[index] ?? 0;
    const currentAlpha = current.thumbnailAlpha?.[index] ?? 0;
    const weight = Math.max(previousAlpha, currentAlpha);
    if (weight <= 0) continue;
    const previousLab = previous.thumbnail?.[index] ?? [0, 0, 0];
    const currentLab = current.thumbnail?.[index] ?? [0, 0, 0];
    spatialChromaTotal += Math.hypot(previousLab[1] - currentLab[1], previousLab[2] - currentLab[2]) * weight;
    spatialLumaTotal += Math.abs(previousLab[0] - currentLab[0]) * weight;
    spatialWeight += weight;
  }
  const spatialChroma = clamp01((spatialWeight > 0 ? spatialChromaTotal / spatialWeight : 0) / 0.24);
  const spatialLuma = clamp01((spatialWeight > 0 ? spatialLumaTotal / spatialWeight : 0) / 0.42);
  const visibility = Math.abs((previous.visibleRatio ?? 0) - (current.visibleRatio ?? 0));
  const averageLumaChange = Math.abs((previous.averageLuma ?? 0) - (current.averageLuma ?? 0));
  const flash = averageLumaChange >= 0.18 && chroma < 0.12 && spatialChroma < 0.14;
  const difference = clamp01(chroma * 0.38 + luma * 0.22 + spatialChroma * 0.22 + spatialLuma * 0.13 + visibility * 0.05);
  return { difference, chroma, luma, spatialChroma, spatialLuma, visibility, flash };
}

export function estimatePaletteUsage(pixels, palette, maximumSamples = 4096) {
  if (!palette.length) return [];
  const pixelCount = Math.floor(pixels.length / 4);
  const step = Math.max(1, Math.floor(pixelCount / maximumSamples));
  const labs = palette.map(rgbToOklab);
  const usage = palette.map(() => 0);
  let total = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const index = pixel * 4;
    const alpha = pixels[index + 3] / 255;
    if (alpha <= 0) continue;
    const lab = rgbToOklab([pixels[index], pixels[index + 1], pixels[index + 2]]);
    let nearest = 0;
    let nearestDistance = Infinity;
    labs.forEach((candidate, paletteIndex) => {
      const distance = oklabDistance(lab, candidate);
      if (distance < nearestDistance) {
        nearest = paletteIndex;
        nearestDistance = distance;
      }
    });
    usage[nearest] += alpha;
    total += alpha;
  }
  return total > 0 ? usage.map((value) => value / total) : palette.map(() => 1 / palette.length);
}

function minimumCostAssignment(costs) {
  const size = costs.length;
  const rowPotential = Array(size + 1).fill(0);
  const columnPotential = Array(size + 1).fill(0);
  const matchedRow = Array(size + 1).fill(0);
  const previousColumn = Array(size + 1).fill(0);
  for (let row = 1; row <= size; row += 1) {
    matchedRow[0] = row;
    let column = 0;
    const minimum = Array(size + 1).fill(Infinity);
    const used = Array(size + 1).fill(false);
    do {
      used[column] = true;
      const activeRow = matchedRow[column];
      let delta = Infinity;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= size; candidate += 1) {
        if (used[candidate]) continue;
        const cost = costs[activeRow - 1][candidate - 1] - rowPotential[activeRow] - columnPotential[candidate];
        if (cost < minimum[candidate]) {
          minimum[candidate] = cost;
          previousColumn[candidate] = column;
        }
        if (minimum[candidate] < delta) {
          delta = minimum[candidate];
          nextColumn = candidate;
        }
      }
      for (let candidate = 0; candidate <= size; candidate += 1) {
        if (used[candidate]) {
          rowPotential[matchedRow[candidate]] += delta;
          columnPotential[candidate] -= delta;
        } else {
          minimum[candidate] -= delta;
        }
      }
      column = nextColumn;
    } while (matchedRow[column] !== 0);
    do {
      const nextColumn = previousColumn[column];
      matchedRow[column] = matchedRow[nextColumn];
      column = nextColumn;
    } while (column !== 0);
  }
  const assignment = Array(size).fill(0);
  for (let column = 1; column <= size; column += 1) assignment[matchedRow[column] - 1] = column - 1;
  return assignment;
}

function createTemporalState(palette, weights, usage, signature, framesSinceCut, transitionCandidate = null) {
  return {
    palette: palette.map((color) => [...color]),
    weights: [...weights],
    usage: [...usage],
    signature,
    framesSinceCut,
    transitionCandidate,
  };
}

function updateTransitionCandidate(previousState, currentSignature, frame, sceneScore) {
  if (!currentSignature || !previousState?.signature) return null;
  const existing = previousState.transitionCandidate;
  const shouldEnter = frame.flash || sceneScore >= 0.46;
  if (!existing) {
    if (!shouldEnter) return null;
    return {
      baselineSignature: previousState.signature,
      signature: currentSignature,
      frames: 1,
      peakScore: sceneScore,
      maximumBaselineDifference: frame.difference,
      flashOrigin: frame.flash,
    };
  }

  const fromBaseline = compareFrameSignatures(existing.baselineSignature, currentSignature);
  if (fromBaseline.difference <= 0.08) return null;
  const fromCandidate = compareFrameSignatures(existing.signature, currentSignature);
  if (!shouldEnter && fromCandidate.difference > 0.22) return null;
  return {
    ...existing,
    signature: currentSignature,
    frames: existing.frames + 1,
    peakScore: Math.max(existing.peakScore, sceneScore),
    maximumBaselineDifference: Math.max(existing.maximumBaselineDifference, fromBaseline.difference),
    flashOrigin: existing.flashOrigin || frame.flash,
  };
}

export function stabilizeFramePalette(currentPalette, currentWeights = [], previousState = null, currentSignature = null, currentUsage = []) {
  const palette = currentPalette.map((color) => [...color]);
  const weights = palette.map((_color, index) => currentWeights[index] ?? 1);
  const usage = palette.map((_color, index) => currentUsage[index] ?? 1 / Math.max(1, palette.length));
  if (!palette.length || !previousState || previousState.palette?.length !== palette.length) {
    const state = createTemporalState(palette, weights, usage, currentSignature, FRAME_SCENE_COOLDOWN);
    return { palette, weights, state, alphas: palette.map(() => 1), sceneCut: false, difference: 0, frameDifference: 0, sceneScore: 0 };
  }

  const referenceLabs = previousState.palette.map(rgbToOklab);
  const currentLabs = palette.map(rgbToOklab);
  const costs = referenceLabs.map((reference) => currentLabs.map((current) => oklabDistance(reference, current)));
  const assignment = minimumCostAssignment(costs);
  const distances = assignment.map((currentIndex, referenceIndex) => costs[referenceIndex][currentIndex]);
  const unweightedDifference = distances.reduce((sum, value) => sum + value, 0) / distances.length;
  const usageTotal = assignment.reduce((sum, currentIndex) => sum + usage[currentIndex], 0) || 1;
  const usageDifference = assignment.reduce((sum, currentIndex, referenceIndex) => sum + distances[referenceIndex] * usage[currentIndex], 0) / usageTotal;
  const difference = unweightedDifference * 0.6 + usageDifference * 0.4;
  const frame = compareFrameSignatures(previousState.signature, currentSignature);
  const paletteChange = clamp01(difference / 0.18);
  const sceneScore = frame.flash ? paletteChange * 0.24 + frame.chroma * 0.2 + frame.spatialChroma * 0.12 : clamp01(
    paletteChange * 0.38 + frame.chroma * 0.24 + frame.spatialChroma * 0.16 + frame.luma * 0.1 + frame.spatialLuma * 0.08 + frame.visibility * 0.04,
  );
  const cooldown = (previousState.framesSinceCut ?? FRAME_SCENE_COOLDOWN) < FRAME_SCENE_COOLDOWN;
  const spatialSceneChange = (frame.spatialChroma >= 0.58 || frame.spatialLuma >= 0.72) && (frame.chroma >= 0.14 || frame.luma >= 0.16);
  const transitionCandidate = updateTransitionCandidate(previousState, currentSignature, frame, sceneScore);
  const sustainedTransition = !cooldown
    && transitionCandidate?.frames >= 3
    && (transitionCandidate.maximumBaselineDifference >= 0.16 || transitionCandidate.peakScore >= 0.58);
  const sceneCut = (!frame.flash && (cooldown ? sceneScore >= 0.9 : sceneScore >= 0.68 || spatialSceneChange)) || sustainedTransition;
  if (sceneCut) {
    const state = createTemporalState(palette, weights, usage, currentSignature, 0);
    return { palette, weights, state, alphas: palette.map(() => 1), sceneCut: true, difference, frameDifference: frame.difference, sceneScore };
  }

  const usedColors = new Set();
  const alphas = assignment.map((currentIndex, referenceIndex) => {
    const colorChange = clamp01((distances[referenceIndex] - 0.008) / 0.14);
    const combinedChange = clamp01(colorChange * 0.55 + frame.difference * 0.3 + paletteChange * 0.15);
    const significantNewColor = distances[referenceIndex] >= 0.085 && usage[currentIndex] >= 0.015;
    let alpha = 0.1 + combinedChange * 0.5;
    if (distances[referenceIndex] < 0.025 && frame.difference < 0.12) alpha = Math.min(alpha, 0.18);
    if (usage[currentIndex] < 0.005) alpha = Math.min(alpha, 0.12);
    if (significantNewColor) alpha = Math.max(alpha, Math.min(0.9, 0.72 + usage[currentIndex] * 1.5));
    if (frame.flash || transitionCandidate?.flashOrigin) {
      alpha = Math.min(alpha, 0.1);
    } else if (transitionCandidate) {
      const transitionPressure = clamp01(Math.max(transitionCandidate.peakScore, transitionCandidate.maximumBaselineDifference));
      alpha = Math.max(alpha, 0.22 + transitionPressure * 0.28);
    }
    return alpha;
  });
  const stabilizedPalette = assignment.map((currentIndex, referenceIndex) => {
    const alpha = alphas[referenceIndex];
    const previous = referenceLabs[referenceIndex];
    const current = currentLabs[currentIndex];
    let candidate = oklabToRgb([
      previous[0] * (1 - alpha) + current[0] * alpha,
      previous[1] * (1 - alpha) + current[1] * alpha,
      previous[2] * (1 - alpha) + current[2] * alpha,
    ]);
    let key = candidate.join(",");
    if (usedColors.has(key)) {
      candidate = palette[currentIndex];
      key = candidate.join(",");
    }
    usedColors.add(key);
    return candidate;
  });
  const stabilizedWeights = assignment.map((currentIndex, referenceIndex) => {
    const alpha = Math.min(0.7, Math.max(0.08, alphas[referenceIndex] * 0.8));
    const previous = previousState.weights?.[referenceIndex] ?? 1;
    return Math.round(Math.min(5, Math.max(0.1, previous * (1 - alpha) + weights[currentIndex] * alpha)) * 100) / 100;
  });
  const orderedUsage = assignment.map((currentIndex) => usage[currentIndex]);
  const state = createTemporalState(
    stabilizedPalette,
    stabilizedWeights,
    orderedUsage,
    currentSignature,
    Math.min(999, (previousState.framesSinceCut ?? FRAME_SCENE_COOLDOWN) + 1),
    transitionCandidate,
  );
  return { palette: stabilizedPalette, weights: stabilizedWeights, state, alphas, sceneCut: false, difference, frameDifference: frame.difference, sceneScore };
}

export function videoOutputSpec(file) {
  const webm = file?.type === "video/webm" || /\.webm$/i.test(file?.name ?? "");
  return webm
    ? { extension: "webm", mime: "video/webm", codec: "vp9", format: "webm" }
    : { extension: "mp4", mime: "video/mp4", codec: "avc", format: "mp4" };
}

export function stagedVideoProgress(stage, progress) {
  const value = Math.min(1, Math.max(0, Number(progress) || 0));
  if (stage === "analysis") return value * 100;
  if (stage === "conversion") return Math.min(99, value * 99);
  if (stage === "finalizing") return 99;
  if (stage === "done") return 100;
  return 0;
}

export function estimateVideoRemainingTime(samples, progress) {
  const currentProgress = Number(progress);
  if (!Array.isArray(samples) || currentProgress >= 99) return null;
  const validSamples = samples
    .filter((sample) => Number.isFinite(sample?.time) && Number.isFinite(sample?.progress))
    .sort((a, b) => a.time - b.time);
  if (validSamples.length < 2) return null;
  const latest = validSamples.at(-1);
  const first = validSamples[0];
  const elapsed = (latest.time - first.time) / 1_000;
  const completed = latest.progress - first.progress;
  if (elapsed < 5 || completed <= 0) return null;

  const overallRate = completed / elapsed;
  const recentWindow = Math.min(300, Math.max(60, elapsed * 0.25));
  const recentSamples = validSamples.filter((sample) => sample.time >= latest.time - recentWindow * 1_000);
  const recentFirst = recentSamples.find((sample) => sample.progress < latest.progress);
  let effectiveRate = overallRate;
  if (recentFirst) {
    const recentElapsed = (latest.time - recentFirst.time) / 1_000;
    const recentCompleted = latest.progress - recentFirst.progress;
    if (recentElapsed >= 5 && recentCompleted > 0) {
      const recentRate = recentCompleted / recentElapsed;
      const boundedRecentRate = Math.min(overallRate * 1.5, Math.max(overallRate * 0.5, recentRate));
      effectiveRate = overallRate * 0.8 + boundedRecentRate * 0.2;
    }
  }

  const remaining = (100 - currentProgress) / effectiveRate;
  return Number.isFinite(remaining) ? Math.round(Math.min(86_400, Math.max(0, remaining))) : null;
}

export function smoothVideoRemainingTime(previous, estimate) {
  if (estimate === null) return previous;
  if (previous === null) return estimate;
  const decayedPrevious = Math.max(0, previous - 1);
  const estimateWeight = estimate > decayedPrevious ? 0.5 : 0.2;
  return decayedPrevious * (1 - estimateWeight) + estimate * estimateWeight;
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
