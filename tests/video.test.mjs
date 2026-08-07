import test from "node:test";
import assert from "node:assert/strict";
import { defaultSettings } from "../lib/palette.mjs";
import {
  createAnalysisTimestamps,
  createCommonPaletteSettings,
  isSupportedVideoFile,
  stagedVideoProgress,
  videoOutputSpec,
} from "../lib/video.mjs";

test("video input validation accepts MP4 and WebM only", () => {
  assert.equal(isSupportedVideoFile({ name: "clip.mp4", type: "video/mp4" }), true);
  assert.equal(isSupportedVideoFile({ name: "clip.webm", type: "" }), true);
  assert.equal(isSupportedVideoFile({ name: "clip.avi", type: "video/x-msvideo" }), false);
});

test("analysis timestamps cover the complete duration deterministically", () => {
  const timestamps = createAnalysisTimestamps(20, 6);
  assert.deepEqual(timestamps, [0, 4, 8, 12, 16, 20]);
  assert.deepEqual(createAnalysisTimestamps(0), [0]);
  assert.equal(createAnalysisTimestamps(1).length, 4);
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
