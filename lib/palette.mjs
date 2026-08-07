export const SETTINGS_VERSION = 1;
export const MAX_COLORS = 32;
export const SETTINGS_SECTIONS = ["adjust", "palette"];

export function defaultSettings() {
  return {
    version: SETTINGS_VERSION,
    colorCount: 5,
    slots: Array.from({ length: 5 }, () => ({ fixed: false, color: null, weight: 1, weightMode: "auto" })),
    adjustments: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    pixelation: { enabled: false, size: 8, alphaMode: "smooth" },
    paletteDiversity: 50,
    export: {
      format: "png",
      fileName: "converted",
      preserveAlpha: true,
      quality: 0.92,
      background: "#FFFFFF",
      keepOriginalSize: true,
    },
    dithering: false,
  };
}

export function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

export function normalizeSlotCount(settings) {
  const normalized = cloneSettings(settings);
  const existing = Array.isArray(normalized.slots) ? normalized.slots : [];
  normalized.slots = Array.from({ length: normalized.colorCount }, (_, index) => existing[index] ?? { fixed: false, color: null, weight: 1, weightMode: "auto" });
  return normalized;
}

export function applyPalettePreset(settings, colors) {
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > MAX_COLORS) throw new Error("프리셋 색상 수가 올바르지 않습니다.");
  if (colors.some((rgb) => !Array.isArray(rgb) || rgb.length !== 3 || rgb.some((value) => !Number.isInteger(value) || value < 0 || value > 255))) {
    throw new Error("프리셋 RGB 색상이 올바르지 않습니다.");
  }
  const applied = cloneSettings(settings);
  applied.colorCount = colors.length;
  applied.slots = colors.map((rgb) => ({ fixed: true, color: [...rgb], weight: 1, weightMode: "manual" }));
  return normalizeSlotCount(applied);
}
export function resetPaletteSettings(settings) {
  const normalized = normalizeSlotCount(settings);
  normalized.slots = Array.from({ length: normalized.colorCount }, () => ({ fixed: false, color: null, weight: 1, weightMode: "auto" }));
  return normalized;
}

export function fixPaletteSlot(settings, index, rgb) {
  const normalized = normalizeSlotCount(settings);
  if (!Number.isInteger(index) || index < 0 || index >= normalized.colorCount) throw new Error("고정할 팔레트 슬롯이 올바르지 않습니다.");
  if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error("고정할 RGB 색상이 올바르지 않습니다.");
  }
  normalized.slots[index] = { ...normalized.slots[index], fixed: true, color: [...rgb], weightMode: "manual" };
  return normalized;
}

export function parsePaletteWeight(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const weight = Number(value);
  return Number.isFinite(weight) && weight >= 0.1 && weight <= 5 ? weight : null;
}

export function hexToRgb(value) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

export function rgbToHex(rgb) {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function rgbToHsv(rgb) {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return [hue, max ? (delta / max) * 100 : 0, max * 100];
}

export function hsvToRgb(hsv) {
  const hue = ((hsv[0] % 360) + 360) % 360;
  const saturation = Math.min(100, Math.max(0, hsv[1])) / 100;
  const value = Math.min(100, Math.max(0, hsv[2])) / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const match = value - chroma;
  let rgb;
  if (hue < 60) rgb = [chroma, x, 0];
  else if (hue < 120) rgb = [x, chroma, 0];
  else if (hue < 180) rgb = [0, chroma, x];
  else if (hue < 240) rgb = [0, x, chroma];
  else if (hue < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  return rgb.map((channel) => Math.round((channel + match) * 255));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function srgbToLinear(value) {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
  const v = clamp(value, 0, 1);
  return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
}

export function rgbToOklab(rgb) {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(l);
  const m3 = Math.cbrt(m);
  const s3 = Math.cbrt(s);
  return [
    0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3,
    1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3,
    0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3,
  ];
}

export function oklabToRgb(lab) {
  const l3 = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
  const m3 = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
  const s3 = lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2];
  const l = l3 ** 3;
  const m = m3 ** 3;
  const s = s3 ** 3;
  return [
    Math.round(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    Math.round(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    Math.round(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

function distanceSq(a, b) {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + da * da + db * db;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3) * 255, hueToRgb(p, q, h) * 255, hueToRgb(p, q, h - 1 / 3) * 255];
}

export function adjustPixels(source, adjustments) {
  const output = new Uint8ClampedArray(source);
  const brightness = adjustments.brightness * 2.55;
  const contrast = adjustments.contrast;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const saturationFactor = 1 + adjustments.saturation / 100;
  const hueShift = adjustments.hue / 360;
  for (let i = 0; i < output.length; i += 4) {
    if (output[i + 3] === 0) continue;
    let r = clamp(factor * (output[i] - 128) + 128 + brightness, 0, 255);
    let g = clamp(factor * (output[i + 1] - 128) + 128 + brightness, 0, 255);
    let b = clamp(factor * (output[i + 2] - 128) + 128 + brightness, 0, 255);
    let [h, s, l] = rgbToHsl(r, g, b);
    h = (h + hueShift + 1) % 1;
    s = clamp(s * saturationFactor, 0, 1);
    [r, g, b] = hslToRgb(h, s, l);
    output[i] = Math.round(r);
    output[i + 1] = Math.round(g);
    output[i + 2] = Math.round(b);
  }
  return output;
}

export function pixelatePixels(source, width, height, size, alphaMode = "smooth") {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height * 4 !== source.length) {
    throw new Error("픽셀화할 이미지 크기가 올바르지 않습니다.");
  }
  if (!Number.isInteger(size) || size < 2 || size > 64) throw new Error("픽셀 크기는 2~64의 정수여야 합니다.");
  if (!['smooth', 'binary'].includes(alphaMode)) throw new Error("픽셀화 알파 방식이 올바르지 않습니다.");
  const output = new Uint8ClampedArray(source.length);
  for (let blockY = 0; blockY < height; blockY += size) {
    for (let blockX = 0; blockX < width; blockX += size) {
      let alphaSum = 0;
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;
      let count = 0;
      const endY = Math.min(height, blockY + size);
      const endX = Math.min(width, blockX + size);
      for (let y = blockY; y < endY; y += 1) {
        for (let x = blockX; x < endX; x += 1) {
          const index = (y * width + x) * 4;
          const alpha = source[index + 3] / 255;
          alphaSum += alpha;
          redSum += source[index] * alpha;
          greenSum += source[index + 1] * alpha;
          blueSum += source[index + 2] * alpha;
          count += 1;
        }
      }
      const rgb = alphaSum ? [redSum / alphaSum, greenSum / alphaSum, blueSum / alphaSum] : [0, 0, 0];
      const averageAlpha = alphaSum / count;
      const alpha = alphaMode === "binary" ? (averageAlpha >= 0.5 ? 255 : 0) : Math.round(averageAlpha * 255);
      for (let y = blockY; y < endY; y += 1) {
        for (let x = blockX; x < endX; x += 1) {
          const index = (y * width + x) * 4;
          output[index] = Math.round(rgb[0]);
          output[index + 1] = Math.round(rgb[1]);
          output[index + 2] = Math.round(rgb[2]);
          output[index + 3] = alpha;
        }
      }
    }
  }
  return output;
}

function sampledColors(pixels, maxSamples = 24000) {
  const pixelCount = pixels.length / 4;
  const step = Math.max(1, Math.floor(pixelCount / maxSamples));
  const samples = [];
  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const index = pixel * 4;
    const alpha = pixels[index + 3] / 255;
    if (alpha === 0) continue;
    const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]];
    samples.push({ rgb, lab: rgbToOklab(rgb), alpha });
  }
  return samples;
}

function diversitySamples(samples, tendency, minimumCandidates) {
  const groups = new Map();
  const salienceStrength = 12 * (1 - Math.abs(2 * tendency - 1));
  let totalSupport = 0;
  for (const sample of samples) {
    const support = sample.alpha ?? 1;
    const chroma = Math.hypot(sample.lab[1], sample.lab[2]);
    const lightnessBand = Math.min(4, Math.floor(sample.lab[0] * 5));
    const hueSector = chroma < 0.025
      ? "neutral"
      : Math.floor((((Math.atan2(sample.lab[2], sample.lab[1]) + Math.PI) / (2 * Math.PI)) * 12)) % 12;
    const chromaBand = chroma < 0.06 ? 0 : chroma < 0.13 ? 1 : 2;
    const key = chroma < 0.025 ? `neutral:${lightnessBand}` : `${hueSector}:${lightnessBand}:${chromaBand}`;
    const salience = 1 + salienceStrength * clamp((chroma - 0.025) / 0.16, 0, 1);
    const group = groups.get(key) ?? { lab: [0, 0, 0], support: 0, importance: 0, representativeWeight: 0, hueSector };
    const representativeWeight = support * salience;
    group.lab[0] += sample.lab[0] * representativeWeight;
    group.lab[1] += sample.lab[1] * representativeWeight;
    group.lab[2] += sample.lab[2] * representativeWeight;
    group.support += support;
    group.importance += representativeWeight;
    group.representativeWeight += representativeWeight;
    totalSupport += support;
    groups.set(key, group);
  }
  const values = Array.from(groups.values(), (group) => ({
    lab: [group.lab[0] / group.representativeWeight, group.lab[1] / group.representativeWeight, group.lab[2] / group.representativeWeight],
    support: group.support,
    importance: group.importance,
    hueSector: group.hueSector,
  })).sort((first, second) => second.support - first.support);
  const minimumSupport = totalSupport >= 1000 ? Math.max(2, totalSupport * 0.001) : 0;
  const supported = values.filter((value) => value.support >= minimumSupport);
  const candidates = supported.length >= minimumCandidates
    ? supported
    : [...supported, ...values.filter((value) => value.support < minimumSupport)].slice(0, minimumCandidates);
  const exponent = tendency <= 0.5
    ? 1.35 - 1.7 * tendency
    : 0.5 - 0.6 * (tendency - 0.5);
  const distancePower = 0.65 + 1.9 * Math.min(tendency, 0.5);
  const rarityStrength = 1 - Math.abs(2 * tendency - 1);
  const sectorTotals = new Map();
  for (const candidate of candidates) sectorTotals.set(candidate.hueSector, (sectorTotals.get(candidate.hueSector) ?? 0) + candidate.support);
  const chromaticTotals = Array.from(sectorTotals.entries()).filter(([sector]) => sector !== "neutral").map(([, support]) => support);
  const averageSectorSupport = chromaticTotals.reduce((sum, support) => sum + support, 0) / Math.max(1, chromaticTotals.length);
  return candidates.map((value) => {
    const sectorSupport = sectorTotals.get(value.hueSector) ?? value.support;
    const rarity = value.hueSector === "neutral" ? 1 : clamp(Math.sqrt(averageSectorSupport / sectorSupport), 1, 3);
    const importance = value.importance * (1 + rarityStrength * (rarity - 1));
    return { lab: value.lab, weight: importance ** exponent, distancePower };
  });
}
function farthestSample(samples, centers) {
  let best = samples[0];
  let bestScore = -1;
  for (const sample of samples) {
    const importance = sample.weight ?? 1;
    const nearest = centers.length
      ? Math.min(...centers.map((center) => distanceSq(sample.lab, center)))
      : sample.weight === undefined ? sample.lab[0] : 1;
    const score = nearest ** (sample.distancePower ?? 1) * importance;
    if (score > bestScore) {
      best = sample;
      bestScore = score;
    }
  }
  return best;
}
export function createPalette(pixels, slots, diversity = 0) {
  const rawSamples = sampledColors(pixels);
  const fixedLabs = slots.filter((slot) => slot.fixed).map((slot) => rgbToOklab(slot.color));
  const automaticCount = slots.length - fixedLabs.length;
  const samples = diversitySamples(rawSamples, clamp(diversity / 100, 0, 1), automaticCount);
  if (!samples.length) {
    return slots.map((slot, index) => slot.fixed ? [...slot.color] : [index * 37 % 256, index * 67 % 256, index * 97 % 256]);
  }
  const automatic = [];
  for (let i = 0; i < automaticCount; i += 1) {
    automatic.push([...farthestSample(samples, [...fixedLabs, ...automatic]).lab]);
  }
  const diversitySeeds = automatic.map((center) => [...center]);
  for (let iteration = 0; iteration < 12 && automatic.length; iteration += 1) {
    const sums = automatic.map(() => [0, 0, 0, 0]);
    for (const sample of samples) {
      const allCenters = [...fixedLabs, ...automatic];
      let nearest = 0;
      let nearestDistance = Infinity;
      for (let c = 0; c < allCenters.length; c += 1) {
        const d = distanceSq(sample.lab, allCenters[c]);
        if (d < nearestDistance) { nearest = c; nearestDistance = d; }
      }
      if (nearest >= fixedLabs.length) {
        const bucket = sums[nearest - fixedLabs.length];
        const weight = sample.weight ?? 1;
        bucket[0] += sample.lab[0] * weight;
        bucket[1] += sample.lab[1] * weight;
        bucket[2] += sample.lab[2] * weight;
        bucket[3] += weight;
      }
    }
    for (let c = 0; c < automatic.length; c += 1) {
      const bucket = sums[c];
      automatic[c] = bucket[3]
        ? [bucket[0] / bucket[3], bucket[1] / bucket[3], bucket[2] / bucket[3]]
        : [...farthestSample(samples, [...fixedLabs, ...automatic.filter((_, index) => index !== c)]).lab];
    }
  }
  const tendency = clamp(diversity / 100, 0, 1);
  const seedInfluence = tendency <= 0.5
    ? 1.2 * tendency
    : 0.6 + 0.4 * ((tendency - 0.5) / 0.5);
  const autoColors = automatic.map((center, index) => {
    const seed = diversitySeeds[index];
    return oklabToRgb(center.map((value, channel) => value * (1 - seedInfluence) + seed[channel] * seedInfluence));
  });
  let autoIndex = 0;
  return slots.map((slot) => slot.fixed ? [...slot.color] : autoColors[autoIndex++]);
}

function refinePaletteForOriginalBalance(pixels, palette, slots, tendency) {
  const strength = 1 - Math.abs(2 * clamp(tendency / 100, 0, 1) - 1);
  if (strength === 0) return palette;
  const paletteLabs = palette.map(rgbToOklab);
  const sums = palette.map(() => [0, 0, 0, 0]);
  const pixelCount = pixels.length / 4;
  const step = Math.max(1, Math.floor(pixelCount / 24000));
  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const index = pixel * 4;
    const alpha = pixels[index + 3] / 255;
    if (alpha === 0) continue;
    const lab = rgbToOklab([pixels[index], pixels[index + 1], pixels[index + 2]]);
    let nearest = 0;
    let nearestDistance = Infinity;
    for (let color = 0; color < paletteLabs.length; color += 1) {
      const distance = distanceSq(lab, paletteLabs[color]);
      if (distance < nearestDistance) { nearest = color; nearestDistance = distance; }
    }
    const chroma = Math.hypot(lab[1], lab[2]);
    const salience = 1 + 8 * clamp((chroma - 0.025) / 0.16, 0, 1);
    const weight = alpha * salience;
    sums[nearest][0] += lab[0] * weight;
    sums[nearest][1] += lab[1] * weight;
    sums[nearest][2] += lab[2] * weight;
    sums[nearest][3] += weight;
  }
  return palette.map((color, index) => {
    if (slots[index].fixed || sums[index][3] === 0) return color;
    const salient = sums[index].slice(0, 3).map((value) => value / sums[index][3]);
    const blend = 0.65 * strength;
    return oklabToRgb(paletteLabs[index].map((value, channel) => value * (1 - blend) + salient[channel] * blend));
  });
}
function preserveSalientAccents(pixels, palette, slots, tendency) {
  const strength = clamp(tendency / 50, 0, 1);
  const automaticSlots = slots.map((slot, index) => slot.fixed ? -1 : index).filter((index) => index >= 0);
  const accentCount = Math.min(3, Math.floor(automaticSlots.length / 2));
  if (strength === 0 || accentCount === 0) return palette;

  const groups = Array.from({ length: 12 }, () => ({ lab: [0, 0, 0], representativeWeight: 0, support: 0, scoreWeight: 0 }));
  const pixelCount = pixels.length / 4;
  const step = Math.max(1, Math.floor(pixelCount / 24000));
  let totalSupport = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const index = pixel * 4;
    const alpha = pixels[index + 3] / 255;
    if (alpha === 0) continue;
    totalSupport += alpha;
    const lab = rgbToOklab([pixels[index], pixels[index + 1], pixels[index + 2]]);
    const chroma = Math.hypot(lab[1], lab[2]);
    if (chroma < 0.055) continue;
    const sector = Math.floor((((Math.atan2(lab[2], lab[1]) + Math.PI) / (2 * Math.PI)) * 12)) % 12;
    const chromaScore = clamp((chroma - 0.04) / 0.22, 0.001, 1);
    const representativeWeight = alpha * chromaScore ** 16;
    const scoreWeight = alpha * (0.15 + 3 * chromaScore ** 2);
    const group = groups[sector];
    group.lab[0] += lab[0] * representativeWeight;
    group.lab[1] += lab[1] * representativeWeight;
    group.lab[2] += lab[2] * representativeWeight;
    group.representativeWeight += representativeWeight;
    group.support += alpha;
    group.scoreWeight += scoreWeight;
  }

  const minimumSupport = totalSupport * 0.001;
  const candidates = groups.map((group, sector) => ({
    sector,
    lab: group.representativeWeight > 0 ? group.lab.map((value) => value / group.representativeWeight) : null,
    support: group.support,
    score: group.support > 0 ? group.support ** 0.35 * (group.scoreWeight / group.support) : 0,
  })).filter((candidate) => candidate.lab && candidate.support >= minimumSupport)
    .sort((first, second) => second.score - first.score);
  const selected = [];
  for (const candidate of candidates) {
    const isNeighbour = selected.some((other) => {
      const gap = Math.abs(candidate.sector - other.sector);
      return Math.min(gap, 12 - gap) <= 1;
    });
    if (!isNeighbour) selected.push(candidate);
    if (selected.length === accentCount) break;
  }

  const output = palette.map((color) => [...color]);
  const outputLabs = output.map(rgbToOklab);
  const available = new Set(automaticSlots);
  for (const candidate of selected) {
    const coveredByFixed = slots.some((slot, index) => slot.fixed && distanceSq(candidate.lab, outputLabs[index]) < 0.01);
    if (coveredByFixed) continue;
    let nearest = -1;
    let nearestDistance = Infinity;
    for (const index of available) {
      const distance = distanceSq(candidate.lab, outputLabs[index]);
      if (distance < nearestDistance) { nearest = index; nearestDistance = distance; }
    }
    if (nearest < 0) break;
    const blend = 0.9 * strength;
    outputLabs[nearest] = outputLabs[nearest].map((value, channel) => value * (1 - blend) + candidate.lab[channel] * blend);
    output[nearest] = oklabToRgb(outputLabs[nearest]);
    available.delete(nearest);
  }
  return output;
}
function automaticPaletteWeights(pixels, palette, slots, tendency) {
  const paletteLabs = palette.map(rgbToOklab);
  const support = palette.map(() => 0);
  const sourceChroma = palette.map(() => 0);
  const pixelCount = pixels.length / 4;
  const step = Math.max(1, Math.floor(pixelCount / 24000));
  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const index = pixel * 4;
    const alpha = pixels[index + 3] / 255;
    if (alpha === 0) continue;
    const lab = rgbToOklab([pixels[index], pixels[index + 1], pixels[index + 2]]);
    let nearest = 0;
    let nearestDistance = Infinity;
    for (let color = 0; color < paletteLabs.length; color += 1) {
      const distance = distanceSq(lab, paletteLabs[color]);
      if (distance < nearestDistance) { nearest = color; nearestDistance = distance; }
    }
    support[nearest] += alpha;
    sourceChroma[nearest] += Math.hypot(lab[1], lab[2]) * alpha;
  }
  const strength = 1 - Math.abs(2 * clamp(tendency / 100, 0, 1) - 1);
  return paletteLabs.map((lab, index) => {
    if (slots[index].weightMode === "manual") return slots[index].weight;
    const paletteChroma = Math.hypot(lab[1], lab[2]);
    const clusterChroma = support[index] > 0 ? sourceChroma[index] / support[index] : paletteChroma;
    const target = clamp(Math.sqrt((clusterChroma + 0.03) / (paletteChroma + 0.03)), 0.7, 1.35);
    return Math.round((1 + (target - 1) * strength) * 100) / 100;
  });
}
export function mapPixels(pixels, palette, weights = palette.map(() => 1)) {
  const output = new Uint8ClampedArray(pixels);
  const paletteLabs = palette.map(rgbToOklab);
  for (let index = 0; index < output.length; index += 4) {
    if (output[index + 3] === 0) continue;
    const lab = rgbToOklab([output[index], output[index + 1], output[index + 2]]);
    let nearest = 0;
    let score = Infinity;
    for (let color = 0; color < paletteLabs.length; color += 1) {
      const weighted = distanceSq(lab, paletteLabs[color]) / weights[color];
      if (weighted < score) { nearest = color; score = weighted; }
    }
    const color = palette[nearest];
    output[index] = color[0];
    output[index + 1] = color[1];
    output[index + 2] = color[2];
  }
  return output;
}
export function prepareImage(pixels, settings, width = pixels.length / 4, height = 1) {
  const validated = validateSettings(settings);
  const adjusted = adjustPixels(pixels, validated.adjustments);
  const prepared = validated.pixelation.enabled ? pixelatePixels(adjusted, width, height, validated.pixelation.size, validated.pixelation.alphaMode) : adjusted;
  return { settings: validated, adjusted, prepared };
}

export function createQuantization(pixels, settings, width = pixels.length / 4, height = 1) {
  const { settings: validated, adjusted, prepared } = prepareImage(pixels, settings, width, height);
  const slots = validated.slots.map((slot) => ({ ...slot, color: slot.color ? [...slot.color] : null }));
  const generatedPalette = createPalette(prepared, slots, validated.paletteDiversity);
  const balancedPalette = refinePaletteForOriginalBalance(prepared, generatedPalette, slots, validated.paletteDiversity);
  const palette = preserveSalientAccents(prepared, balancedPalette, slots, validated.paletteDiversity);
  const weights = automaticPaletteWeights(prepared, palette, slots, validated.paletteDiversity);
  return { adjusted, prepared, palette, weights };
}

export function quantizeImage(pixels, settings, width = pixels.length / 4, height = 1) {
  const quantization = createQuantization(pixels, settings, width, height);
  const result = mapPixels(quantization.prepared, quantization.palette, quantization.weights);
  return { ...quantization, result };
}

function isFiniteInRange(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function validateSettings(input) {
  if (!input || typeof input !== "object") throw new Error("설정 파일의 형식이 올바르지 않습니다.");
  if (input.version !== SETTINGS_VERSION) throw new Error(`지원하지 않는 설정 버전입니다: ${String(input.version)}`);
  if (!Number.isInteger(input.colorCount) || input.colorCount < 1 || input.colorCount > MAX_COLORS) {
    throw new Error(`최종 색상 수는 1~${MAX_COLORS}의 정수여야 합니다.`);
  }
  if (!Array.isArray(input.slots) || input.slots.length !== input.colorCount) {
    throw new Error("팔레트 슬롯 수가 최종 색상 수와 일치하지 않습니다.");
  }
  const slots = input.slots.map((slot, index) => {
    if (!slot || typeof slot !== "object" || typeof slot.fixed !== "boolean") throw new Error(`${index + 1}번 슬롯이 올바르지 않습니다.`);
    if (!isFiniteInRange(slot.weight, 0.1, 5)) throw new Error(`${index + 1}번 슬롯 가중치는 0.1~5여야 합니다.`);
    let color = null;
    if (slot.color !== null && slot.color !== undefined) {
      if (!Array.isArray(slot.color) || slot.color.length !== 3 || slot.color.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) {
        throw new Error(`${index + 1}번 슬롯 색상이 올바르지 않습니다.`);
      }
      color = [...slot.color];
    }
    if (slot.fixed && !color) throw new Error(`${index + 1}번 고정 슬롯에 색상이 없습니다.`);
    const weightMode = slot.weightMode ?? (slot.weight === 1 ? "auto" : "manual");
    if (!["auto", "manual"].includes(weightMode)) throw new Error(`${index + 1}번 슬롯 가중치 방식이 올바르지 않습니다.`);
    return { fixed: slot.fixed, color, weight: slot.weight, weightMode };
  });
  const base = defaultSettings();
  const adjustments = { ...base.adjustments, ...(input.adjustments || {}) };
  for (const key of ["brightness", "contrast", "saturation"]) {
    if (!isFiniteInRange(adjustments[key], -100, 100)) throw new Error(`${key} 값은 -100~100이어야 합니다.`);
  }
  if (!isFiniteInRange(adjustments.hue, -180, 180)) throw new Error("색조 값은 -180~180이어야 합니다.");
  const pixelation = { ...base.pixelation, ...(input.pixelation || {}) };
  if (typeof pixelation.enabled !== "boolean") throw new Error("픽셀화 사용 여부가 올바르지 않습니다.");
  if (!Number.isInteger(pixelation.size) || pixelation.size < 2 || pixelation.size > 64) throw new Error("픽셀 크기는 2~64의 정수여야 합니다.");
  if (!['smooth', 'binary'].includes(pixelation.alphaMode)) throw new Error("픽셀화 알파 방식이 올바르지 않습니다.");
  const paletteDiversity = input.paletteDiversity ?? base.paletteDiversity;
  if (!Number.isInteger(paletteDiversity) || paletteDiversity < 0 || paletteDiversity > 100) throw new Error("자동 팔레트 성향은 0~100의 정수여야 합니다.");
  const exportSettings = { ...base.export, ...(input.export || {}) };
  if (!['png', 'jpeg', 'webp'].includes(exportSettings.format)) throw new Error("지원하지 않는 출력 형식입니다.");
  if (typeof exportSettings.fileName !== "string" || !exportSettings.fileName.trim()) throw new Error("출력 파일명이 비어 있습니다.");
  if (!isFiniteInRange(exportSettings.quality, 0.1, 1)) throw new Error("품질은 0.1~1이어야 합니다.");
  if (!hexToRgb(exportSettings.background)) throw new Error("배경색이 올바르지 않습니다.");
  if (typeof exportSettings.preserveAlpha !== "boolean") throw new Error("투명도 설정이 올바르지 않습니다.");
  if (typeof exportSettings.keepOriginalSize !== "boolean") throw new Error("출력 해상도 설정이 올바르지 않습니다.");
  const normalized = { ...base, ...input, slots, adjustments, pixelation, paletteDiversity, export: exportSettings, version: SETTINGS_VERSION, dithering: false };
  delete normalized.edgePreservation;
  return normalized;
}

export function getExportDimensions(width, height, settings) {
  if (settings.pixelation?.enabled && settings.export?.keepOriginalSize === false) {
    return { width: Math.ceil(width / settings.pixelation.size), height: Math.ceil(height / settings.pixelation.size) };
  }
  return { width, height };
}

function validateSettingsSections(input) {
  if (!Array.isArray(input) || input.length === 0) throw new Error("저장할 설정 항목을 하나 이상 선택해야 합니다.");
  if (new Set(input).size !== input.length || input.some((section) => !SETTINGS_SECTIONS.includes(section))) {
    throw new Error("설정 파일의 저장 항목 정보가 올바르지 않습니다.");
  }
  return SETTINGS_SECTIONS.filter((section) => input.includes(section));
}

function lockResolvedPaletteSlots(slots) {
  return slots.map((slot) => slot.color ? { ...slot, fixed: true, color: [...slot.color] } : { ...slot });
}

export function serializeSettings(settings, includedSections = SETTINGS_SECTIONS) {
  const validated = validateSettings(settings);
  const sections = validateSettingsSections(includedSections);
  const document = {
    version: SETTINGS_VERSION,
    includedSections: sections,
    export: cloneSettings(validated.export),
    dithering: false,
  };
  if (sections.includes("adjust")) {
    document.adjustments = cloneSettings(validated.adjustments);
    document.pixelation = cloneSettings(validated.pixelation);
  }
  if (sections.includes("palette")) {
    document.colorCount = validated.colorCount;
    document.slots = lockResolvedPaletteSlots(validated.slots);
    document.paletteDiversity = validated.paletteDiversity;
  }
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function deserializeSettingsDocument(text, currentSettings = defaultSettings()) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error("JSON 형식이 올바르지 않습니다."); }

  if (!parsed || typeof parsed !== "object") throw new Error("설정 파일의 형식이 올바르지 않습니다.");
  if (parsed.includedSections === undefined) {
    return { settings: validateSettings(parsed), includedSections: [...SETTINGS_SECTIONS], legacy: true };
  }
  if (parsed.version !== SETTINGS_VERSION) throw new Error(`지원하지 않는 설정 버전입니다: ${String(parsed.version)}`);

  const includedSections = validateSettingsSections(parsed.includedSections);
  const merged = cloneSettings(currentSettings);
  if (includedSections.includes("adjust")) {
    if (!parsed.adjustments || !parsed.pixelation) throw new Error("ADJUST 설정이 누락되었습니다.");
    merged.adjustments = parsed.adjustments;
    merged.pixelation = parsed.pixelation;
  }
  if (includedSections.includes("palette")) {
    if (!Number.isInteger(parsed.colorCount) || !Array.isArray(parsed.slots)) throw new Error("PALETTE 설정이 누락되었습니다.");
    merged.colorCount = parsed.colorCount;
    merged.slots = parsed.slots;
    merged.paletteDiversity = parsed.paletteDiversity ?? defaultSettings().paletteDiversity;
  }
  if (parsed.export !== undefined) merged.export = parsed.export;
  merged.version = SETTINGS_VERSION;
  merged.dithering = false;
  const settings = validateSettings(merged);
  if (includedSections.includes("palette")) settings.slots = lockResolvedPaletteSlots(settings.slots);
  return { settings, includedSections, legacy: false };
}

export function deserializeSettings(text, currentSettings = defaultSettings()) {
  return deserializeSettingsDocument(text, currentSettings).settings;
}

export function countUniqueOpaqueColors(pixels) {
  const colors = new Set();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] !== 0) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
  }
  return colors.size;
}
