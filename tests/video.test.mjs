import test from "node:test";
import assert from "node:assert/strict";
import { defaultSettings } from "../lib/palette.mjs";
import {
  createAnalysisTimestamps,
  createCommonPaletteSettings,
  createFramePaletteSettings,
  FRAME_PALETTE_HISTORY_LIMIT,
  formatVideoElapsedTime,
  isSupportedVideoFile,
  stabilizeFramePalette,
  stagedVideoProgress,
  videoOutputDimensions,
  videoOutputSpec,
  videoPaletteSummaryColor,
} from "../lib/video.mjs";

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

test("frame palettes are matched and smoothed against recent frames", () => {
  const history = [
    { palette: [[200, 40, 40], [35, 60, 205]], weights: [1, 1] },
    { palette: [[204, 42, 39], [37, 63, 208]], weights: [1.1, 0.9] },
  ];
  const current = [[40, 66, 212], [212, 46, 38]];
  const stabilized = stabilizeFramePalette(current, [0.8, 1.2], history);

  assert.equal(stabilized.sceneCut, false);
  assert.ok(stabilized.difference < 0.12);
  assert.ok(stabilized.palette[0][0] > stabilized.palette[0][2], "first slot remains the red cluster");
  assert.ok(stabilized.palette[1][2] > stabilized.palette[1][0], "second slot remains the blue cluster");
  assert.notDeepEqual(stabilized.palette, current, "minor frame changes are smoothed");
  assert.ok(stabilized.weights[0] > 1 && stabilized.weights[1] < 1, "weights follow the matched slot order");
});

test("large palette changes are treated as a scene cut without blending", () => {
  const current = [[0, 230, 255], [245, 225, 15], [240, 245, 250]];
  const stabilized = stabilizeFramePalette(current, [0.8, 1.1, 1], [
    { palette: [[20, 14, 12], [70, 35, 28], [115, 55, 40]], weights: [1, 1, 1] },
  ]);

  assert.equal(FRAME_PALETTE_HISTORY_LIMIT, 4);
  assert.equal(stabilized.sceneCut, true);
  assert.ok(stabilized.difference >= 0.12);
  assert.deepEqual(stabilized.palette, current);
  assert.deepEqual(stabilized.weights, [0.8, 1.1, 1]);
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
