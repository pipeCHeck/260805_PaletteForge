import { createQuantization, mapPixels, prepareImage } from "../lib/palette.mjs";
import { createFrameSignature, estimatePaletteUsage, stabilizeFramePalette } from "../lib/video.mjs";

type RGB = [number, number, number];
type TemporalPaletteState = { palette: RGB[]; weights: number[]; usage: number[]; signature: unknown; framesSinceCut: number; transitionCandidate?: unknown };
let temporalPaletteState: TemporalPaletteState | null = null;

self.onmessage = (event: MessageEvent<{ operation?: "prepare" | "quantize"; pixels: ArrayBuffer; width: number; height: number; settings: unknown; temporalPaletteEnabled?: boolean }>) => {
  try {
    const pixels = new Uint8ClampedArray(event.data.pixels);
    if (event.data.operation === "prepare") {
      const { prepared } = prepareImage(pixels, event.data.settings, event.data.width, event.data.height);
      self.postMessage({ result: prepared.buffer }, { transfer: [prepared.buffer] });
      return;
    }
    const output = createQuantization(pixels, event.data.settings, event.data.width, event.data.height);
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
    const result = mapPixels(output.prepared, stabilized.palette, stabilized.weights);
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
