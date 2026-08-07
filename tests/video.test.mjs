import test from "node:test";
import assert from "node:assert/strict";
import { defaultSettings } from "../lib/palette.mjs";
import {
  createAnalysisTimestamps,
  createCommonPaletteSettings,
  createFrameSignature,
  createFramePaletteSettings,
  compareFrameSignatures,
  estimatePaletteUsage,
  FRAME_SCENE_COOLDOWN,
  formatVideoElapsedTime,
  isSupportedVideoFile,
  stabilizeFramePalette,
  stagedVideoProgress,
  videoOutputDimensions,
  videoOutputSpec,
  videoPaletteSummaryColor,
} from "../lib/video.mjs";

function solidFrame(width, height, color, alpha = 255) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = alpha;
  }
  return pixels;
}

test("video input validation accepts MP4 and WebM only", () => {
  assert.equal(isSupportedVideoFile({ name: "clip.mp4", type: "video/mp4" }), true);
  assert.equal(isSupportedVideoFile({ name: "clip.webm", type: "" }), true);
  assert.equal(isSupportedVideoFile({ name: "clip.avi", type: "video/x-msvideo" }), false);
});

test("analysis timestamps cover the complete duration deterministically", () => {
  const timestamps = createAnalysisTimestamps(20, 6);
  assert.equal(timestamps.length, 6);
  assert.equal(timestamps[0], 0);
  assert.ok(timestamps.at(-1) < 20 && timestamps.at(-1) > 19.9);
  assert.deepEqual(timestamps, createAnalysisTimestamps(20, 6));
  assert.deepEqual(createAnalysisTimestamps(0), [0]);
  assert.equal(createAnalysisTimestamps(1).length, 4);
});

test("H.264 output rounds odd dimensions up while VP9 preserves them", () => {
  assert.deepEqual(videoOutputDimensions(701, 1335, "avc"), { width: 702, height: 1336 });
  assert.deepEqual(videoOutputDimensions(701, 1335, "vp9"), { width: 701, height: 1335 });
  assert.deepEqual(videoOutputDimensions(1920, 1080, "avc"), { width: 1920, height: 1080 });
});

test("frame palette summaries use a deterministic bounded 4-bit color cube", () => {
  assert.deepEqual(videoPaletteSummaryColor([254, 126, 1]), [255, 119, 0]);
  const colors = new Set();
  for (let red = 0; red < 256; red += 7) {
    for (let green = 0; green < 256; green += 11) {
      for (let blue = 0; blue < 256; blue += 13) colors.add(videoPaletteSummaryColor([red, green, blue]).join(","));
    }
  }
  assert.ok(colors.size <= 4096);
});

test("common palette settings lock analyzed colors and weights", () => {
  const settings = defaultSettings();
  const palette = [[12, 34, 56], [200, 210, 220]];
  const applied = createCommonPaletteSettings(settings, palette, [1.2, 0.8]);
  assert.equal(applied.colorCount, 2);
  assert.deepEqual(applied.slots, [
    { fixed: true, color: [12, 34, 56], weight: 1.2, weightMode: "manual" },
    { fixed: true, color: [200, 210, 220], weight: 0.8, weightMode: "manual" },
  ]);
  assert.equal(settings.colorCount, 5);
});

test("frame palette settings ignore every fixed color and manual weight", () => {
  const settings = defaultSettings();
  settings.colorCount = 2;
  settings.paletteDiversity = 78;
  settings.adjustments.brightness = 12;
  settings.slots = [
    { fixed: true, color: [255, 0, 0], weight: 4, weightMode: "manual" },
    { fixed: true, color: [0, 0, 255], weight: 0.2, weightMode: "manual" },
  ];
  const applied = createFramePaletteSettings(settings);
  assert.equal(applied.colorCount, 2);
  assert.equal(applied.paletteDiversity, 78);
  assert.equal(applied.adjustments.brightness, 12);
  assert.deepEqual(applied.slots, [
    { fixed: false, color: null, weight: 1, weightMode: "auto" },
    { fixed: false, color: null, weight: 1, weightMode: "auto" },
  ]);
});

test("frame palettes use optimal color matching and strong smoothing for small changes", () => {
  const signature = createFrameSignature(solidFrame(32, 18, [90, 100, 110]), 32, 18);
  const initial = stabilizeFramePalette([[204, 42, 39], [37, 63, 208]], [1.1, 0.9], null, signature, [0.6, 0.4]);
  const current = [[40, 66, 212], [212, 46, 38]];
  const stabilized = stabilizeFramePalette(current, [0.8, 1.2], initial.state, signature, [0.4, 0.6]);

  assert.equal(stabilized.sceneCut, false);
  assert.ok(stabilized.difference < 0.12);
  assert.ok(stabilized.palette[0][0] > stabilized.palette[0][2], "first slot remains the red cluster");
  assert.ok(stabilized.palette[1][2] > stabilized.palette[1][0], "second slot remains the blue cluster");
  assert.notDeepEqual(stabilized.palette, current, "minor frame changes are smoothed");
  assert.ok(stabilized.alphas.every((alpha) => alpha <= 0.18), "nearly identical colors retain the stable palette strongly");
  assert.ok(stabilized.weights[0] > 1 && stabilized.weights[1] < 1, "weights follow the matched slot order");
});

test("large palette and frame changes trigger an immediate scene cut", () => {
  const previousSignature = createFrameSignature(solidFrame(32, 18, [65, 32, 25]), 32, 18);
  const currentSignature = createFrameSignature(solidFrame(32, 18, [0, 220, 250]), 32, 18);
  const initial = stabilizeFramePalette(
    [[20, 14, 12], [70, 35, 28], [115, 55, 40]],
    [1, 1, 1],
    null,
    previousSignature,
    [0.3, 0.4, 0.3],
  );
  const current = [[0, 230, 255], [245, 225, 15], [240, 245, 250]];
  const stabilized = stabilizeFramePalette(current, [0.8, 1.1, 1], initial.state, currentSignature, [0.5, 0.3, 0.2]);

  assert.equal(FRAME_SCENE_COOLDOWN, 3);
  assert.equal(stabilized.sceneCut, true);
  assert.ok(stabilized.difference >= 0.12);
  assert.deepEqual(stabilized.palette, current);
  assert.deepEqual(stabilized.weights, [0.8, 1.1, 1]);
  assert.equal(stabilized.state.framesSinceCut, 0);
});

test("a brightness-only flash does not reset the temporal palette", () => {
  const darkSignature = createFrameSignature(solidFrame(32, 18, [45, 45, 45]), 32, 18);
  const brightSignature = createFrameSignature(solidFrame(32, 18, [225, 225, 225]), 32, 18);
  const comparison = compareFrameSignatures(darkSignature, brightSignature);
  const initial = stabilizeFramePalette([[35, 35, 35], [80, 80, 80]], [1, 1], null, darkSignature, [0.7, 0.3]);
  const stabilized = stabilizeFramePalette([[210, 210, 210], [245, 245, 245]], [1, 1], initial.state, brightSignature, [0.6, 0.4]);

  assert.equal(comparison.flash, true);
  assert.equal(stabilized.sceneCut, false);
  assert.ok(stabilized.sceneScore < 0.68);
  assert.ok(stabilized.alphas.every((alpha) => alpha <= 0.1), "a transient flash barely moves the stable palette");
  assert.equal(stabilized.state.transitionCandidate.frames, 1);
});

test("a single-frame flash is discarded when the original scene returns", () => {
  const darkSignature = createFrameSignature(solidFrame(32, 18, [45, 45, 45]), 32, 18);
  const brightSignature = createFrameSignature(solidFrame(32, 18, [225, 225, 225]), 32, 18);
  const initial = stabilizeFramePalette([[35, 35, 35]], [1], null, darkSignature, [1]);
  const flash = stabilizeFramePalette([[230, 230, 230]], [1], initial.state, brightSignature, [1]);
  const returned = stabilizeFramePalette([[35, 35, 35]], [1], flash.state, darkSignature, [1]);

  assert.equal(flash.sceneCut, false);
  assert.equal(returned.sceneCut, false);
  assert.equal(returned.state.transitionCandidate, null);
  assert.ok(returned.palette[0][0] < 60, "the one-frame flash does not remain in the stable palette");
});

test("a persistent brightness transition becomes a new scene after three frames", () => {
  const darkSignature = createFrameSignature(solidFrame(32, 18, [45, 45, 45]), 32, 18);
  const brightSignature = createFrameSignature(solidFrame(32, 18, [225, 225, 225]), 32, 18);
  let result = stabilizeFramePalette([[35, 35, 35]], [1], null, darkSignature, [1]);

  result = stabilizeFramePalette([[230, 230, 230]], [1], result.state, brightSignature, [1]);
  assert.equal(result.sceneCut, false);
  result = stabilizeFramePalette([[230, 230, 230]], [1], result.state, brightSignature, [1]);
  assert.equal(result.sceneCut, false);
  result = stabilizeFramePalette([[230, 230, 230]], [1], result.state, brightSignature, [1]);

  assert.equal(result.sceneCut, true);
  assert.deepEqual(result.palette, [[230, 230, 230]]);
  assert.equal(result.state.transitionCandidate, null);
});

test("a significant new color adapts faster than existing matched colors", () => {
  const signature = createFrameSignature(solidFrame(32, 18, [90, 95, 100]), 32, 18);
  const initial = stabilizeFramePalette(
    [[90, 90, 90], [30, 80, 190], [40, 145, 70]],
    [1, 1, 1],
    null,
    signature,
    [0.45, 0.45, 0.1],
  );
  const stabilized = stabilizeFramePalette(
    [[92, 91, 90], [32, 82, 192], [225, 45, 35]],
    [1, 1, 1],
    initial.state,
    signature,
    [0.44, 0.44, 0.12],
  );

  const sortedAlphas = [...stabilized.alphas].sort((a, b) => a - b);
  assert.ok(sortedAlphas[0] <= 0.18);
  assert.ok(sortedAlphas.at(-1) >= 0.72);
  assert.equal(stabilized.sceneCut, false);
});

test("temporal EMA substantially reduces repeated palette jitter", () => {
  const signature = createFrameSignature(solidFrame(32, 18, [110, 80, 75]), 32, 18);
  const generated = [[200, 48, 55], [194, 43, 61], [205, 51, 50], [196, 45, 59], [202, 49, 53]];
  let state = null;
  let previousGenerated = null;
  let previousStable = null;
  let generatedMotion = 0;
  let stableMotion = 0;
  generated.forEach((color) => {
    const result = stabilizeFramePalette([color], [1], state, signature, [1]);
    if (previousGenerated) generatedMotion += previousGenerated.reduce((sum, value, index) => sum + Math.abs(value - color[index]), 0);
    if (previousStable) stableMotion += previousStable.reduce((sum, value, index) => sum + Math.abs(value - result.palette[0][index]), 0);
    previousGenerated = color;
    previousStable = result.palette[0];
    state = result.state;
  });
  assert.ok(stableMotion < generatedMotion * 0.45, `expected ${stableMotion} to be much smaller than ${generatedMotion}`);
});

test("palette usage sampling ignores transparent pixels and stays normalized", () => {
  const pixels = solidFrame(4, 1, [255, 0, 0]);
  pixels.set([0, 0, 255, 255], 8);
  pixels.set([0, 255, 0, 0], 12);
  const usage = estimatePaletteUsage(pixels, [[255, 0, 0], [0, 0, 255]]);
  assert.ok(Math.abs(usage[0] - 2 / 3) < 0.001);
  assert.ok(Math.abs(usage[1] - 1 / 3) < 0.001);
});

test("video output preserves the source container family", () => {
  assert.deepEqual(videoOutputSpec({ name: "movie.mp4", type: "video/mp4" }), { extension: "mp4", mime: "video/mp4", codec: "avc", format: "mp4" });
  assert.deepEqual(videoOutputSpec({ name: "movie.webm", type: "video/webm" }), { extension: "webm", mime: "video/webm", codec: "vp9", format: "webm" });
});

test("staged progress remains monotonic and reserves finalization", () => {
  assert.equal(stagedVideoProgress("analysis", 0.5), 10);
  assert.equal(stagedVideoProgress("conversion", 0), 20);
  assert.equal(stagedVideoProgress("conversion", 0, false), 0);
  assert.equal(stagedVideoProgress("conversion", 0.5, false), 49);
  assert.equal(stagedVideoProgress("conversion", 1), 98);
  assert.equal(stagedVideoProgress("finalizing", 1), 99);
  assert.equal(stagedVideoProgress("done", 1), 100);
});

test("video elapsed time uses a stable clock format", () => {
  assert.equal(formatVideoElapsedTime(0), "00:00");
  assert.equal(formatVideoElapsedTime(65.9), "01:05");
  assert.equal(formatVideoElapsedTime(3661), "1:01:01");
  assert.equal(formatVideoElapsedTime(-10), "00:00");
});
