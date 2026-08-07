import { createQuantization, mapPixels, prepareImage } from "../lib/palette.mjs";
import { stabilizeFramePalette } from "../lib/video.mjs";

type RGB = [number, number, number];
type PaletteHistoryEntry = { palette: RGB[]; weights: number[] };

self.onmessage = (event: MessageEvent<{ operation?: "prepare" | "quantize"; pixels: ArrayBuffer; width: number; height: number; settings: unknown; temporalPaletteHistory?: PaletteHistoryEntry[] }>) => {
  try {
    const pixels = new Uint8ClampedArray(event.data.pixels);
    if (event.data.operation === "prepare") {
      const { prepared } = prepareImage(pixels, event.data.settings, event.data.width, event.data.height);
      self.postMessage({ result: prepared.buffer }, { transfer: [prepared.buffer] });
      return;
    }
    const output = createQuantization(pixels, event.data.settings, event.data.width, event.data.height);
    const stabilized = stabilizeFramePalette(output.palette, output.weights, event.data.temporalPaletteHistory);
    const result = mapPixels(output.prepared, stabilized.palette, stabilized.weights);
    self.postMessage(
      { result: result.buffer, palette: stabilized.palette, weights: stabilized.weights, sceneCut: stabilized.sceneCut, difference: stabilized.difference },
      { transfer: [result.buffer] },
    );
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "이미지 변환에 실패했습니다." });
  }
};
