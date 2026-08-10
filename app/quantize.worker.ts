import { createQuantization, mapPixels, mapPixelsWithTemporalHysteresis, prepareImage } from "../lib/palette.mjs";
import { createFrameSignature, estimatePaletteUsage, stabilizeFramePalette } from "../lib/video.mjs";

type RGB = [number, number, number];
type TemporalPaletteState = { palette: RGB[]; weights: number[]; usage: number[]; signature: unknown; framesSinceCut: number; transitionCandidate?: unknown };
let temporalPaletteState: TemporalPaletteState | null = null;
let temporalAssignments: Uint8Array | null = null;
let temporalSourceLuma: Uint8Array | null = null;
let temporalPaletteSize = 0;
let commonPaletteCacheKey = "";
let commonPaletteCache: Uint8Array | null = null;

function fixedPaletteFromSettings(settings: unknown) {
  if (!settings || typeof settings !== "object" || !("slots" in settings) || !Array.isArray(settings.slots)) return null;
  const slots = settings.slots as Array<{ fixed?: boolean; color?: RGB | null; weight?: number; weightMode?: string }>;
  if (!slots.length || slots.some((slot) => !slot.fixed || !Array.isArray(slot.color) || slot.color.length !== 3 || slot.weightMode !== "manual")) return null;
  return {
    palette: slots.map((slot) => [...slot.color!] as RGB),
    weights: slots.map((slot) => slot.weight ?? 1),
  };
}

function exactCommonPaletteCache(palette: RGB[], weights: number[]) {
  const key = `${palette.map((color) => color.join(",")).join(";")}|${weights.join(",")}`;
  if (!commonPaletteCache || commonPaletteCacheKey !== key) {
    commonPaletteCache = new Uint8Array(2 ** 24);
    commonPaletteCache.fill(255);
    commonPaletteCacheKey = key;
  }
  return commonPaletteCache;
}

self.onmessage = (event: MessageEvent<{ operation?: "prepare" | "map-fixed" | "quantize"; pixels: ArrayBuffer; width: number; height: number; settings: unknown; temporalPaletteEnabled?: boolean }>) => {
  try {
    const pixels = new Uint8ClampedArray(event.data.pixels);
    const fixedPalette = event.data.temporalPaletteEnabled ? null : fixedPaletteFromSettings(event.data.settings);
    if (event.data.operation === "prepare") {
      const { prepared } = prepareImage(pixels, event.data.settings, event.data.width, event.data.height, { inPlace: Boolean(fixedPalette) });
      self.postMessage({ result: prepared.buffer }, { transfer: [prepared.buffer] });
      return;
    }
    if (event.data.operation === "map-fixed") {
      if (!fixedPalette) throw new Error("고정 팔레트 매핑 설정이 올바르지 않습니다.");
      const result = mapPixels(pixels, fixedPalette.palette, fixedPalette.weights, {
        width: event.data.width,
        height: event.data.height,
        surfaceCleanup: 0,
        exactColorCache: exactCommonPaletteCache(fixedPalette.palette, fixedPalette.weights),
        inPlace: true,
      });
      self.postMessage({ result: result.buffer, palette: fixedPalette.palette, weights: fixedPalette.weights }, { transfer: [result.buffer] });
      return;
    }
    const output = fixedPalette
      ? { ...prepareImage(pixels, event.data.settings, event.data.width, event.data.height, { inPlace: true }), ...fixedPalette }
      : createQuantization(pixels, event.data.settings, event.data.width, event.data.height);
    const stabilized = event.data.temporalPaletteEnabled
      ? stabilizeFramePalette(
        output.palette,
        output.weights,
        temporalPaletteState,
        createFrameSignature(pixels, event.data.width, event.data.height),
        estimatePaletteUsage(output.prepared, output.palette),
      )
      : { palette: output.palette, weights: output.weights, state: null, sceneCut: false, difference: 0, frameDifference: 0, sceneScore: 0 };
    temporalPaletteState = event.data.temporalPaletteEnabled ? stabilized.state as TemporalPaletteState : null;
    let result: Uint8ClampedArray;
    if (event.data.temporalPaletteEnabled) {
      if (stabilized.sceneCut || temporalPaletteSize !== stabilized.palette.length) {
        temporalAssignments = null;
        temporalSourceLuma = null;
      }
      const mapped = mapPixelsWithTemporalHysteresis(
        output.prepared,
        stabilized.palette,
        stabilized.weights,
        temporalAssignments,
        temporalSourceLuma,
        { width: event.data.width, height: event.data.height, surfaceCleanup: output.settings.surfaceCleanup },
      );
      result = mapped.result;
      temporalAssignments = mapped.assignments;
      temporalSourceLuma = mapped.sourceLuma;
      temporalPaletteSize = stabilized.palette.length;
    } else {
      temporalAssignments = null;
      temporalSourceLuma = null;
      temporalPaletteSize = 0;
      result = mapPixels(output.prepared, stabilized.palette, stabilized.weights, {
        width: event.data.width,
        height: event.data.height,
        surfaceCleanup: output.settings.surfaceCleanup,
        exactColorCache: fixedPalette ? exactCommonPaletteCache(stabilized.palette, stabilized.weights) : undefined,
        inPlace: Boolean(fixedPalette),
      });
    }
    self.postMessage(
      {
        result: result.buffer,
        palette: stabilized.palette,
        weights: stabilized.weights,
        sceneCut: stabilized.sceneCut,
        difference: stabilized.difference,
        frameDifference: stabilized.frameDifference,
        sceneScore: stabilized.sceneScore,
      },
      { transfer: [result.buffer] },
    );
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "이미지 변환에 실패했습니다." });
  }
};
