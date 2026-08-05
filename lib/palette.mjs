export const SETTINGS_VERSION = 1;
export const MAX_COLORS = 32;

export function defaultSettings() {
  return {
    version: SETTINGS_VERSION,
    colorCount: 5,
    slots: Array.from({ length: 5 }, () => ({ fixed: false, color: null, weight: 1 })),
    adjustments: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
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

function sampledColors(pixels, maxSamples = 24000) {
  const opaqueCount = pixels.length / 4;
  const step = Math.max(1, Math.floor(opaqueCount / maxSamples));
  const samples = [];
  for (let pixel = 0; pixel < opaqueCount; pixel += step) {
    const i = pixel * 4;
    if (pixels[i + 3] === 0) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    samples.push({ rgb, lab: rgbToOklab(rgb) });
  }
  return samples;
}

function farthestSample(samples, centers) {
  let best = samples[0];
  let bestDistance = -1;
  for (const sample of samples) {
    const nearest = centers.length ? Math.min(...centers.map((center) => distanceSq(sample.lab, center))) : sample.lab[0];
    if (nearest > bestDistance) {
      best = sample;
      bestDistance = nearest;
    }
  }
  return best;
}

export function createPalette(pixels, slots) {
  const samples = sampledColors(pixels);
  const fixedLabs = slots.filter((slot) => slot.fixed).map((slot) => rgbToOklab(slot.color));
  if (!samples.length) {
    return slots.map((slot, index) => slot.fixed ? [...slot.color] : [index * 37 % 256, index * 67 % 256, index * 97 % 256]);
  }
  const automaticCount = slots.length - fixedLabs.length;
  const automatic = [];
  for (let i = 0; i < automaticCount; i += 1) {
    automatic.push([...farthestSample(samples, [...fixedLabs, ...automatic]).lab]);
  }
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
        bucket[0] += sample.lab[0]; bucket[1] += sample.lab[1]; bucket[2] += sample.lab[2]; bucket[3] += 1;
      }
    }
    for (let c = 0; c < automatic.length; c += 1) {
      const bucket = sums[c];
      automatic[c] = bucket[3]
        ? [bucket[0] / bucket[3], bucket[1] / bucket[3], bucket[2] / bucket[3]]
        : [...farthestSample(samples, [...fixedLabs, ...automatic.filter((_, index) => index !== c)]).lab];
    }
  }
  const autoColors = automatic.map(oklabToRgb);
  let autoIndex = 0;
  return slots.map((slot) => slot.fixed ? [...slot.color] : autoColors[autoIndex++]);
}

export function mapPixels(pixels, palette, weights = palette.map(() => 1)) {
  const output = new Uint8ClampedArray(pixels);
  const labs = palette.map(rgbToOklab);
  for (let i = 0; i < output.length; i += 4) {
    if (output[i + 3] === 0) continue;
    const lab = rgbToOklab([output[i], output[i + 1], output[i + 2]]);
    let nearest = 0;
    let score = Infinity;
    for (let c = 0; c < labs.length; c += 1) {
      const weighted = distanceSq(lab, labs[c]) / weights[c];
      if (weighted < score) { nearest = c; score = weighted; }
    }
    output[i] = palette[nearest][0];
    output[i + 1] = palette[nearest][1];
    output[i + 2] = palette[nearest][2];
  }
  return output;
}

export function quantizeImage(pixels, settings) {
  const validated = validateSettings(settings);
  const adjusted = adjustPixels(pixels, validated.adjustments);
  const slots = validated.slots.map((slot) => ({ ...slot, color: slot.color ? [...slot.color] : null }));
  const palette = createPalette(adjusted, slots);
  const result = mapPixels(adjusted, palette, slots.map((slot) => slot.weight));
  return { adjusted, result, palette };
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
    return { fixed: slot.fixed, color, weight: slot.weight };
  });
  const base = defaultSettings();
  const adjustments = { ...base.adjustments, ...(input.adjustments || {}) };
  for (const key of ["brightness", "contrast", "saturation"]) {
    if (!isFiniteInRange(adjustments[key], -100, 100)) throw new Error(`${key} 값은 -100~100이어야 합니다.`);
  }
  if (!isFiniteInRange(adjustments.hue, -180, 180)) throw new Error("색조 값은 -180~180이어야 합니다.");
  const exportSettings = { ...base.export, ...(input.export || {}) };
  if (!['png', 'jpeg', 'webp'].includes(exportSettings.format)) throw new Error("지원하지 않는 출력 형식입니다.");
  if (typeof exportSettings.fileName !== "string" || !exportSettings.fileName.trim()) throw new Error("출력 파일명이 비어 있습니다.");
  if (!isFiniteInRange(exportSettings.quality, 0.1, 1)) throw new Error("품질은 0.1~1이어야 합니다.");
  if (!hexToRgb(exportSettings.background)) throw new Error("배경색이 올바르지 않습니다.");
  if (typeof exportSettings.preserveAlpha !== "boolean") throw new Error("투명도 설정이 올바르지 않습니다.");
  return { ...base, ...input, slots, adjustments, export: exportSettings, version: SETTINGS_VERSION, dithering: false };
}

export function serializeSettings(settings) {
  return `${JSON.stringify(validateSettings(settings), null, 2)}\n`;
}

export function deserializeSettings(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error("JSON 형식이 올바르지 않습니다."); }
  return validateSettings(parsed);
}

export function countUniqueOpaqueColors(pixels) {
  const colors = new Set();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] !== 0) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
  }
  return colors.size;
}
