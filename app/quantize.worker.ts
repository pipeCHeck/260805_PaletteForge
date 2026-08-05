import { quantizeImage } from "../lib/palette.mjs";

self.onmessage = (event: MessageEvent<{ pixels: ArrayBuffer; settings: unknown }>) => {
  try {
    const pixels = new Uint8ClampedArray(event.data.pixels);
    const output = quantizeImage(pixels, event.data.settings);
    self.postMessage(
      { result: output.result.buffer, palette: output.palette },
      { transfer: [output.result.buffer] },
    );
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "이미지 변환에 실패했습니다." });
  }
};

