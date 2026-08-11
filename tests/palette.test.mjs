import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPalettePreset,
  adjustPixels,
  cloneSettings,
  countUniqueOpaqueColors,
  cyclePaletteSlotMode,
  defaultSettings,
  deserializeSettings,
  deserializeSettingsDocument,
  dominantColorizeHue,
  fixPaletteSlot,
  fixPaletteSlotWeight,
  getExportDimensions,
  hsvToRgb,
  mapPixels,
  paletteSlotMode,
  parsePaletteWeight,
  pixelatePixels,
  prepareImage,
  quantizeImage,
  rgbToHsv,
  rgbToOklab,
  removePaletteSlot,
  resetPaletteSettings,
  serializeSettings,
} from "../lib/palette.mjs";

function pixels(colors) {
  return new Uint8ClampedArray(colors.flatMap((color) => [color[0], color[1], color[2], color.length === 4 ? color[3] : 255]));
}

function configured(count) {
  const settings = defaultSettings();
  settings.colorCount = count;
  settings.slots = Array.from({ length: count }, () => ({ fixed: false, color: null, weight: 1, weightMode: "auto" }));
  return settings;
}

test("면 정리 기본값은 균형인 50이다", () => {
  assert.equal(defaultSettings().surfaceCleanup, 50);
});

test("단일 색상화는 주된 색상 계열로 통일되고 기존 보정과 알파를 그대로 반영한다", () => {
  const source = pixels([[80, 190, 90], [75, 180, 85], [70, 170, 80], [0, 195, 255], [255, 0, 166], [20, 40, 60, 0]]);
  const settings = defaultSettings();
  settings.colorize = { enabled: true };
  const { adjusted } = prepareImage(source, settings, 6, 1);
  const firstLab = rgbToOklab(Array.from(adjusted.slice(0, 3)));
  const targetHue = Math.atan2(firstLab[2], firstLab[1]);
  for (let index = 0; index < 5; index += 1) {
    const originalLab = rgbToOklab(Array.from(source.slice(index * 4, index * 4 + 3)));
    const resultLab = rgbToOklab(Array.from(adjusted.slice(index * 4, index * 4 + 3)));
    const resultHue = Math.atan2(resultLab[2], resultLab[1]);
    const hueDifference = Math.abs(Math.atan2(Math.sin(resultHue - targetHue), Math.cos(resultHue - targetHue)));
    assert.ok(hueDifference < 0.12);
    assert.ok(Math.abs(originalLab[0] - resultLab[0]) < 0.035);
  }
  assert.deepEqual(Array.from(adjusted.slice(20, 24)), [20, 40, 60, 0]);

  const hueShiftedSettings = cloneSettings(settings);
  hueShiftedSettings.adjustments.hue = 90;
  const shifted = prepareImage(source, hueShiftedSettings, 6, 1).adjusted;
  const shiftedLab = rgbToOklab(Array.from(shifted.slice(0, 3)));
  const shiftedHue = Math.atan2(shiftedLab[2], shiftedLab[1]);
  const hueMovement = Math.abs(Math.atan2(Math.sin(shiftedHue - targetHue), Math.cos(shiftedHue - targetHue)));
  assert.ok(hueMovement > 0.8);

  const brighterSettings = cloneSettings(settings);
  brighterSettings.adjustments.brightness = 25;
  const brighter = prepareImage(source, brighterSettings, 6, 1).adjusted;
  assert.ok(rgbToOklab(Array.from(brighter.slice(0, 3)))[0] > firstLab[0]);
});

test("단일 색상화의 색조는 히스토그램 구간에 갇히지 않고 연속적으로 이동한다", () => {
  const source = pixels([[80, 190, 90], [75, 180, 85], [70, 170, 80], [88, 175, 76]]);
  const settings = defaultSettings();
  settings.colorize = { enabled: true };
  const samples = [0, 3, 6, 9, 12].map((hue) => {
    settings.adjustments.hue = hue;
    const adjusted = prepareImage(source, settings, 4, 1).adjusted;
    const lab = rgbToOklab(Array.from(adjusted.slice(0, 3)));
    return {
      color: Array.from(adjusted.slice(0, 3)).join(","),
      hue: Math.atan2(lab[2], lab[1]),
    };
  });
  const hueSteps = samples.slice(1).map((sample, index) => (
    Math.abs(Math.atan2(
      Math.sin(sample.hue - samples[index].hue),
      Math.cos(sample.hue - samples[index].hue),
    ))
  ));

  assert.ok(new Set(samples.map((sample) => sample.color)).size >= 4);
  assert.ok(hueSteps.every((step) => step > 0.015 && step < 0.09));
});

test("단일 색상화를 먼저 적용한 뒤 밝기·대비·채도·색조를 순서대로 보정한다", () => {
  const source = pixels([[40, 175, 225], [225, 75, 115], [85, 185, 70], [245, 190, 45]]);
  const colorizeOnly = defaultSettings();
  colorizeOnly.colorize.enabled = true;
  const colorized = adjustPixels(source, colorizeOnly.adjustments, { colorize: colorizeOnly.colorize });
  const adjustments = { brightness: 24, contrast: -18, saturation: 35, hue: 41 };
  const expected = adjustPixels(colorized, adjustments, { colorize: { enabled: false } });
  const actual = adjustPixels(source, adjustments, { colorize: { enabled: true } });

  assert.deepEqual(actual, expected);
});

test("고정된 영상 전체 색상 기준은 프레임의 주조색이 달라도 같은 계열을 유지한다", () => {
  const redFrame = pixels([[210, 45, 55], [190, 38, 50], [225, 70, 65]]);
  const blueFrame = pixels([[35, 90, 220], [45, 105, 205], [25, 75, 195]]);
  const combined = new Uint8ClampedArray(redFrame.length + blueFrame.length);
  combined.set(redFrame);
  combined.set(blueFrame, redFrame.length);
  const settings = defaultSettings();
  settings.colorize = { enabled: true };
  const baseHue = dominantColorizeHue(combined, settings.adjustments);
  const red = adjustPixels(redFrame, settings.adjustments, { colorize: settings.colorize, colorizeBaseHue: baseHue });
  const blue = adjustPixels(blueFrame, settings.adjustments, { colorize: settings.colorize, colorizeBaseHue: baseHue });
  const redLab = rgbToOklab(Array.from(red.slice(0, 3)));
  const blueLab = rgbToOklab(Array.from(blue.slice(0, 3)));
  const hueDifference = Math.abs(Math.atan2(
    Math.sin(Math.atan2(redLab[2], redLab[1]) - Math.atan2(blueLab[2], blueLab[1])),
    Math.cos(Math.atan2(redLab[2], redLab[1]) - Math.atan2(blueLab[2], blueLab[1])),
  ));
  assert.ok(hueDifference < 0.12);
});

test("팔레트 프리셋은 보정 설정을 유지하고 색상 고정·가중치 자동 상태로 적용한다", () => {
  const settings = configured(5);
  settings.adjustments.hue = 34;
  settings.pixelation = { enabled: true, size: 6, alphaMode: "smooth" };
  const colors = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];
  const applied = applyPalettePreset(settings, colors);
  assert.equal(applied.colorCount, 4);
  assert.deepEqual(applied.slots, colors.map((color) => ({ fixed: true, color, weight: 1, weightMode: "auto" })));
  assert.deepEqual(applied.adjustments, settings.adjustments);
  assert.deepEqual(applied.pixelation, settings.pixelation);
  assert.notStrictEqual(applied.slots[0].color, colors[0]);
});

test("특정 팔레트 색상을 삭제하면 순서를 유지하며 최종 색상 수도 하나 줄어든다", () => {
  const settings = configured(3);
  settings.slots = [
    { fixed: true, color: [10, 20, 30], weight: 1.2, weightMode: "manual" },
    { fixed: false, color: null, weight: 1, weightMode: "auto" },
    { fixed: true, color: [200, 210, 220], weight: 2, weightMode: "manual" },
  ];
  const removed = removePaletteSlot(settings, 1);
  assert.equal(removed.colorCount, 2);
  assert.equal(removed.slots.length, 2);
  assert.deepEqual(removed.slots[0], settings.slots[0]);
  assert.deepEqual(removed.slots[1], settings.slots[2]);
  assert.throws(() => removePaletteSlot(configured(1), 0), /최소 한 가지/);
  assert.throws(() => removePaletteSlot(settings, 3), /올바르지 않습니다/);
});
test("결과의 불투명 RGB 색상 수가 설정값을 넘지 않는다", () => {
  const source = pixels([[255, 0, 0], [230, 20, 10], [0, 255, 0], [0, 0, 255], [20, 20, 220], [255, 255, 0]]);
  const { result } = quantizeImage(source, configured(3));
  assert.ok(countUniqueOpaqueColors(result) <= 3);
});

test("고정 색상은 결과 팔레트에 정확히 포함되고 변경되지 않는다", () => {
  const settings = configured(3);
  settings.slots[1] = { fixed: true, color: [240, 20, 0], weight: 1, weightMode: "auto" };
  const source = pixels([[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
  const first = quantizeImage(source, settings);
  const second = quantizeImage(source, settings);
  assert.deepEqual(first.palette[1], [240, 20, 0]);
  assert.deepEqual(second.palette[1], [240, 20, 0]);
});

test("모든 슬롯이 고정이면 지정 팔레트만 사용한다", () => {
  const settings = configured(2);
  settings.slots = [
    { fixed: true, color: [10, 20, 30], weight: 1, weightMode: "auto" },
    { fixed: true, color: [220, 230, 240], weight: 1, weightMode: "auto" },
  ];
  const output = quantizeImage(pixels([[0, 0, 0], [255, 255, 255]]), settings);
  assert.deepEqual(output.palette, [[10, 20, 30], [220, 230, 240]]);
  assert.equal(countUniqueOpaqueColors(output.result), 2);
});

test("높은 가중치는 해당 색상의 픽셀 비중을 증가시킨다", () => {
  const source = pixels(Array.from({ length: 9 }, (_, index) => [80 + index * 10, 80 + index * 10, 80 + index * 10]));
  const palette = [[0, 0, 0], [255, 255, 255]];
  const neutral = mapPixels(source, palette, [1, 1]);
  const weighted = mapPixels(source, palette, [1, 5]);
  const whiteCount = (data) => Array.from({ length: data.length / 4 }, (_, index) => data[index * 4]).filter((value) => value === 255).length;
  assert.ok(whiteCount(weighted) > whiteCount(neutral));
});

test("정확 색상 캐시와 제자리 매핑은 기존 공통 팔레트 결과를 그대로 유지한다", () => {
  const source = pixels([
    [12, 34, 56], [127, 128, 129], [240, 20, 80], [12, 34, 56],
    [80, 170, 210], [127, 128, 129], [250, 240, 20], [240, 20, 80],
  ]);
  const palette = [[5, 10, 20], [220, 30, 75], [40, 180, 220], [245, 230, 35]];
  const weights = [1, 1.4, 0.8, 1.1];
  const expected = mapPixels(source, palette, weights, { width: 4, height: 2, surfaceCleanup: 100 });
  const cache = new Uint8Array(2 ** 24);
  cache.fill(255);
  const optimizedSource = new Uint8ClampedArray(source);
  const actual = mapPixels(optimizedSource, palette, weights, {
    width: 4,
    height: 2,
    surfaceCleanup: 100,
    exactColorCache: cache,
    inPlace: true,
  });
  assert.strictEqual(actual, optimizedSource);
  assert.deepEqual(actual, expected);

  const repeated = mapPixels(new Uint8ClampedArray(source), palette, weights, {
    width: 4,
    height: 2,
    surfaceCleanup: 100,
    exactColorCache: cache,
    inPlace: true,
  });
  assert.deepEqual(repeated, expected);
});

test("제자리 색 보정과 기본값 빠른 경로는 기존 픽셀 결과를 그대로 유지한다", () => {
  const source = pixels([[12, 34, 56], [127, 128, 129], [240, 20, 80, 120], [250, 240, 20]]);
  const adjustedSettings = { brightness: 17, contrast: -23, saturation: 31, hue: 42 };
  const expected = adjustPixels(source, adjustedSettings);
  const inPlaceSource = new Uint8ClampedArray(source);
  const actual = adjustPixels(inPlaceSource, adjustedSettings, { inPlace: true });
  assert.strictEqual(actual, inPlaceSource);
  assert.deepEqual(actual, expected);

  const neutralSource = new Uint8ClampedArray(source);
  const neutral = adjustPixels(neutralSource, { brightness: 0, contrast: 0, saturation: 0, hue: 0 }, { inPlace: true });
  assert.strictEqual(neutral, neutralSource);
  assert.deepEqual(neutral, source);
});

test("가중치 입력은 편집 중간 상태와 유효한 소수를 구분한다", () => {
  assert.equal(parsePaletteWeight(""), null);
  assert.equal(parsePaletteWeight("0."), null);
  assert.equal(parsePaletteWeight("0.5"), 0.5);
  assert.equal(parsePaletteWeight("0.4"), 0.4);
  assert.equal(parsePaletteWeight("5"), 5);
  assert.equal(parsePaletteWeight("0.09"), null);
  assert.equal(parsePaletteWeight("5.1"), null);
});

test("기본 자동 팔레트는 원본의 주요 톤과 충분한 면적의 강조색을 함께 보존한다", () => {
  const colors = [];
  const add = (count, color) => { for (let index = 0; index < count; index += 1) colors.push(color); };
  add(5000, [22, 14, 16]);
  add(2200, [92, 62, 48]);
  add(700, [175, 150, 100]);
  add(420, [225, 35, 60]);
  add(260, [70, 130, 225]);
  add(500, [230, 210, 45]);
  const output = quantizeImage(pixels(colors), configured(6), colors.length, 1);
  const hasRed = output.palette.some(([red, green, blue]) => red > green + 90 && red > blue + 70);
  const hasBlue = output.palette.some(([red, green, blue]) => blue > red + 70 && blue > green + 35);
  const hasYellow = output.palette.some(([red, green, blue]) => red > 170 && green > 160 && blue < 100);
  assert.equal(hasRed, true);
  assert.equal(hasBlue, true);
  assert.equal(hasYellow, true);
  assert.ok(output.weights.every((weight) => weight >= 0.7 && weight <= 1.35));
});

test("자동 가중치는 원본 색 분포에 맞춰 계산되고 수동 가중치는 그대로 유지된다", () => {
  const settings = configured(2);
  settings.slots = [
    { fixed: true, color: [15, 12, 12], weight: 2.2, weightMode: "manual" },
    { fixed: true, color: [235, 35, 55], weight: 1, weightMode: "auto" },
  ];
  const source = pixels([
    ...Array.from({ length: 80 }, () => [25, 18, 18]),
    ...Array.from({ length: 20 }, () => [135, 65, 70]),
  ]);
  const output = quantizeImage(source, settings, 100, 1);
  assert.equal(output.weights[0], 2.2);
  assert.ok(output.weights[1] < 1);
});

test("이전 설정의 가중치 방식은 값에 따라 자동 또는 수동으로 호환된다", () => {
  const legacy = configured(2);
  delete legacy.slots[0].weightMode;
  delete legacy.slots[1].weightMode;
  legacy.slots[1].weight = 1.7;
  const loaded = deserializeSettings(JSON.stringify(legacy));
  assert.equal(loaded.slots[0].weightMode, "auto");
  assert.equal(loaded.slots[1].weightMode, "manual");
});
test("RGB와 HSV 색상 선택 값은 왕복 변환된다", () => {
  for (const rgb of [[255, 0, 0], [0, 255, 0], [0, 0, 255], [241, 208, 151], [0, 0, 0], [255, 255, 255]]) {
    assert.deepEqual(hsvToRgb(rgbToHsv(rgb)), rgb);
  }
});

test("가중치 1은 기본 OKLab 최근접 매핑과 동일하다", () => {
  const source = pixels([[10, 10, 10], [245, 245, 245]]);
  assert.deepEqual(Array.from(mapPixels(source, [[0, 0, 0], [255, 255, 255]], [1, 1])), [0, 0, 0, 255, 255, 255, 255, 255]);
});

test("면 정리 강도 0은 기존 최근접 매핑 결과를 정확히 유지한다", () => {
  const source = pixels([[117, 117, 117], [123, 123, 123], [117, 117, 117]]);
  const palette = [[100, 100, 100], [140, 140, 140]];
  const original = mapPixels(source, palette, [1, 1]);
  const disabled = mapPixels(source, palette, [1, 1], { width: 3, height: 1, surfaceCleanup: 0 });
  assert.deepEqual(disabled, original);
});

test("높은 면 정리 강도는 평탄한 영역의 고립된 팔레트 잡색을 정리한다", () => {
  const source = pixels(Array.from({ length: 9 }, (_, index) => index === 4 ? [123, 123, 123] : [117, 117, 117]));
  const palette = [[100, 100, 100], [140, 140, 140]];
  const original = mapPixels(source, palette, [1, 1]);
  const cleaned = mapPixels(source, palette, [1, 1], { width: 3, height: 3, surfaceCleanup: 100 });
  assert.equal(original[4 * 4], 140);
  assert.equal(cleaned[4 * 4], 100);
  assert.equal(countUniqueOpaqueColors(cleaned), 1);
});

test("면 정리 최대값은 중간 강도에서 남는 넓은 색 덩어리까지 통합한다", () => {
  const patch = new Set([52, 53, 54, 55, 64, 65, 66, 67, 76, 77, 78, 79, 88, 89, 90, 91]);
  const source = pixels(Array.from({ length: 144 }, (_, index) => patch.has(index) ? [127, 127, 127] : [117, 117, 117]));
  const palette = [[100, 100, 100], [140, 140, 140]];
  const medium = mapPixels(source, palette, [1, 1], { width: 12, height: 12, surfaceCleanup: 70 });
  const maximum = mapPixels(source, palette, [1, 1], { width: 12, height: 12, surfaceCleanup: 100 });
  const lightPixels = (data) => Array.from({ length: 144 }, (_, index) => data[index * 4]).filter((value) => value === 140).length;
  assert.equal(lightPixels(medium), 16);
  assert.equal(lightPixels(maximum), 0);
});

test("면 정리는 원본의 강한 경계와 알파를 보존한다", () => {
  const source = pixels([
    [100, 100, 100], [100, 100, 100], [140, 140, 140], [140, 140, 140],
    [100, 100, 100, 90], [100, 100, 100], [140, 140, 140], [140, 140, 140, 0],
  ]);
  const palette = [[100, 100, 100], [140, 140, 140]];
  const cleaned = mapPixels(source, palette, [1, 1], { width: 4, height: 2, surfaceCleanup: 100 });
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => cleaned[index * 4]), [100, 100, 140, 140, 100, 100, 140, 140]);
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => cleaned[index * 4 + 3]), [255, 255, 255, 255, 90, 255, 255, 0]);
});

test("완전 투명 픽셀은 추출과 색상 수 계산에서 제외된다", () => {
  const source = pixels([[255, 0, 0, 0], [0, 255, 0], [0, 0, 255]]);
  const { result } = quantizeImage(source, configured(1));
  assert.equal(countUniqueOpaqueColors(result), 1);
  assert.equal(result[3], 0);
});

test("변환 전후에 완전·부분 투명 픽셀의 알파 값이 그대로 유지된다", () => {
  const source = pixels([[255, 0, 0, 0], [0, 255, 0, 80], [0, 0, 255, 180], [255, 255, 0, 255]]);
  const { adjusted, result } = quantizeImage(source, configured(2));
  const alpha = (data) => Array.from({ length: data.length / 4 }, (_, index) => data[index * 4 + 3]);
  assert.deepEqual(alpha(adjusted), [0, 80, 180, 255]);
  assert.deepEqual(alpha(result), [0, 80, 180, 255]);
});

test("픽셀화는 설정한 블록을 같은 평균 색상으로 만든다", () => {
  const source = pixels([
    [0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 0, 255],
    [255, 255, 255], [0, 0, 0], [0, 0, 255], [255, 0, 0],
  ]);
  const result = pixelatePixels(source, 4, 2, 2);
  const colors = Array.from({ length: 8 }, (_, index) => Array.from(result.slice(index * 4, index * 4 + 4)));
  assert.deepEqual(colors.slice(0, 2), [[128, 128, 128, 255], [128, 128, 128, 255]]);
  assert.deepEqual(colors.slice(2, 4), [[128, 0, 128, 255], [128, 0, 128, 255]]);
  assert.deepEqual(colors.slice(4, 6), colors.slice(0, 2));
  assert.deepEqual(colors.slice(6, 8), colors.slice(2, 4));
});

test("픽셀화는 투명 블록을 알파 가중 평균으로 처리한다", () => {
  const source = pixels([[255, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const result = pixelatePixels(source, 2, 2, 2);
  for (let index = 0; index < 4; index += 1) assert.deepEqual(Array.from(result.slice(index * 4, index * 4 + 4)), [255, 0, 0, 64]);
});

test("0·1 알파 픽셀화는 블록 평균 알파를 50% 기준으로 이진화한다", () => {
  const below = pixelatePixels(pixels([[255, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 2, 2, 2, "binary");
  const above = pixelatePixels(pixels([[255, 0, 0], [255, 0, 0], [255, 0, 0], [0, 0, 0, 0]]), 2, 2, 2, "binary");
  for (let index = 3; index < below.length; index += 4) assert.equal(below[index], 0);
  for (let index = 3; index < above.length; index += 4) assert.equal(above[index], 255);
});

test("미리보기 전처리와 실제 양자화는 동일한 보정·픽셀화 결과를 사용한다", () => {
  const source = pixels([[10, 30, 50], [90, 110, 130], [170, 190, 210], [250, 230, 210]]);
  const settings = configured(2);
  settings.adjustments = { brightness: 17, contrast: -12, saturation: 24, hue: 35 };
  settings.pixelation = { enabled: true, size: 2, alphaMode: "smooth" };
  const preview = prepareImage(source, settings, 2, 2);
  const converted = quantizeImage(source, settings, 2, 2);
  assert.deepEqual(preview.adjusted, converted.adjusted);
  assert.deepEqual(preview.prepared, converted.prepared);
});

test("픽셀 최적화 내보내기는 블록 하나를 출력 픽셀 하나로 계산한다", () => {
  const settings = defaultSettings();
  settings.pixelation.enabled = true;
  settings.pixelation.size = 8;
  assert.deepEqual(getExportDimensions(101, 65, settings), { width: 101, height: 65 });
  settings.export.keepOriginalSize = false;
  assert.deepEqual(getExportDimensions(101, 65, settings), { width: 13, height: 9 });
  settings.pixelation.enabled = false;
  assert.deepEqual(getExportDimensions(101, 65, settings), { width: 101, height: 65 });
});

test("설정 저장 후 불러오면 동일하게 복원된다", () => {
  const settings = configured(2);
  settings.slots[0] = { fixed: true, color: [240, 20, 0], weight: 1.7, weightMode: "manual" };
  settings.adjustments.hue = 25;
  settings.colorize = { enabled: true };
  settings.pixelation = { enabled: true, size: 12, alphaMode: "binary" };
  settings.export.keepOriginalSize = false;
  assert.deepEqual(deserializeSettings(serializeSettings(settings)), settings);
});

test("ADJUST 전용 설정은 현재 팔레트를 유지하면서 보정과 픽셀화를 적용한다", () => {
  const saved = configured(2);
  saved.adjustments = { brightness: 21, contrast: -14, saturation: 37, hue: 48 };
  saved.colorize = { enabled: true };
  saved.pixelation = { enabled: true, size: 9, alphaMode: "binary" };
  saved.export.fileName = "adjust-preset";
  const current = configured(4);
  current.slots[1] = { fixed: true, color: [12, 34, 56], weight: 2.2, weightMode: "manual" };

  const serialized = serializeSettings(saved, ["adjust"]);
  const document = JSON.parse(serialized);
  assert.equal("colorCount" in document, false);
  assert.equal("slots" in document, false);
  const loaded = deserializeSettingsDocument(serialized, current);
  assert.deepEqual(loaded.includedSections, ["adjust"]);
  assert.deepEqual(loaded.settings.adjustments, saved.adjustments);
  assert.deepEqual(loaded.settings.colorize, saved.colorize);
  assert.deepEqual(loaded.settings.pixelation, saved.pixelation);
  assert.equal(loaded.settings.colorCount, current.colorCount);
  assert.deepEqual(loaded.settings.slots, current.slots);
  assert.deepEqual(loaded.settings.export, saved.export);
});

test("PALETTE 전용 설정은 현재 보정을 유지하면서 팔레트를 적용한다", () => {
  const saved = configured(3);
  saved.slots[0] = { fixed: true, color: [240, 20, 0], weight: 1.8, weightMode: "manual" };
  saved.slots[1] = { fixed: false, color: [20, 190, 80], weight: 0.7, weightMode: "manual" };
  saved.slots[2] = { fixed: false, color: [30, 70, 230], weight: 2.4, weightMode: "manual" };
  const current = configured(5);
  current.adjustments.hue = -55;
  current.pixelation = { enabled: true, size: 14, alphaMode: "smooth" };
  const expectedSlots = saved.slots.map((slot) => ({ ...slot, fixed: true }));

  const serialized = serializeSettings(saved, ["palette"]);
  const document = JSON.parse(serialized);
  assert.equal("adjustments" in document, false);
  assert.equal("pixelation" in document, false);
  assert.deepEqual(document.slots, expectedSlots);
  const loaded = deserializeSettingsDocument(serialized, current);
  assert.deepEqual(loaded.includedSections, ["palette"]);
  assert.equal(loaded.settings.colorCount, saved.colorCount);
  assert.deepEqual(loaded.settings.slots, expectedSlots);
  assert.deepEqual(loaded.settings.adjustments, current.adjustments);
  assert.deepEqual(loaded.settings.pixelation, current.pixelation);
  const converted = quantizeImage(pixels([[250, 10, 0], [0, 200, 70], [20, 50, 240]]), loaded.settings);
  assert.deepEqual(converted.palette, expectedSlots.map((slot) => slot.color));
});

test("이전 선택 저장 파일의 자동 팔레트 색상도 불러오면 고정된다", () => {
  const document = JSON.parse(serializeSettings(configured(2), ["palette"]));
  document.slots = [
    { fixed: false, color: [11, 22, 33], weight: 1 },
    { fixed: false, color: [210, 220, 230], weight: 1.5 },
  ];
  const loaded = deserializeSettingsDocument(JSON.stringify(document), configured(4));
  assert.deepEqual(loaded.settings.slots, [
    { fixed: true, color: [11, 22, 33], weight: 1, weightMode: "auto" },
    { fixed: true, color: [210, 220, 230], weight: 1.5, weightMode: "manual" },
  ]);
});

test("범위 정보가 없는 기존 설정 파일은 전체 설정으로 불러온다", () => {
  const legacy = configured(2);
  legacy.adjustments.brightness = 33;
  legacy.slots[0] = { fixed: true, color: [1, 2, 3], weight: 1.4, weightMode: "manual" };
  const current = configured(6);
  const loaded = deserializeSettingsDocument(JSON.stringify(legacy), current);
  assert.equal(loaded.legacy, true);
  assert.deepEqual(loaded.includedSections, ["adjust", "palette"]);
  assert.deepEqual(loaded.settings, legacy);
});

test("저장 범위가 비어 있거나 알 수 없는 항목이면 오류를 표시한다", () => {
  const settings = defaultSettings();
  assert.throws(() => serializeSettings(settings, []), /하나 이상/);
  const invalid = JSON.parse(serializeSettings(settings));
  invalid.includedSections = ["unknown"];
  assert.throws(() => deserializeSettingsDocument(JSON.stringify(invalid), settings), /저장 항목/);
});

test("동일 입력과 설정은 항상 동일한 결과를 만든다", () => {
  const source = pixels([[10, 40, 70], [90, 120, 150], [180, 210, 240], [25, 100, 225]]);
  const settings = configured(2);
  const a = quantizeImage(source, settings);
  const b = quantizeImage(source, settings);
  assert.deepEqual(a.palette, b.palette);
  assert.deepEqual(a.result, b.result);
});

test("이미지별 설정 복제본은 서로 섞이지 않는다", () => {
  const first = defaultSettings();
  const second = cloneSettings(first);
  second.adjustments.brightness = 50;
  second.slots[0].weight = 3;
  assert.equal(first.adjustments.brightness, 0);
  assert.equal(first.slots[0].weight, 1);
});

test("고정 색상을 연속 추가해도 팔레트 슬롯 수는 줄지 않고 가중치는 자동 상태를 유지한다", () => {
  let settings = configured(5);
  settings.slots[0].weight = 1.24;
  settings = fixPaletteSlot(settings, 0, [240, 20, 0]);
  settings = fixPaletteSlot(settings, 1, [20, 190, 80]);
  settings = fixPaletteSlot(settings, 2, [30, 70, 230]);
  assert.equal(settings.colorCount, 5);
  assert.equal(settings.slots.length, 5);
  assert.equal(settings.slots.filter((slot) => slot.fixed).length, 3);
  assert.deepEqual(settings.slots.slice(0, 3).map((slot) => slot.color), [[240, 20, 0], [20, 190, 80], [30, 70, 230]]);
  assert.equal(settings.slots[0].weight, 1.24);
  assert.equal(settings.slots[0].weightMode, "auto");
  assert.equal(settings.slots[1].weight, 1);
  assert.equal(settings.slots[1].weightMode, "auto");
});

test("팔레트 슬롯 상태는 자동에서 색 고정, 전체 고정, 다시 자동 순서로 전환된다", () => {
  let settings = configured(2);
  assert.equal(paletteSlotMode(settings.slots[0]), "auto");
  settings = cyclePaletteSlotMode(settings, 0, [12, 34, 56]);
  assert.equal(paletteSlotMode(settings.slots[0]), "color-fixed");
  assert.deepEqual(settings.slots[0].color, [12, 34, 56]);
  settings.slots[0].weight = 1.27;
  settings = cyclePaletteSlotMode(settings, 0, [12, 34, 56]);
  assert.equal(paletteSlotMode(settings.slots[0]), "fixed");
  assert.equal(settings.slots[0].weight, 1.27);
  settings = cyclePaletteSlotMode(settings, 0, [12, 34, 56]);
  assert.deepEqual(settings.slots[0], { fixed: false, color: null, weight: 1, weightMode: "auto" });
});

test("가중치를 직접 지정하면 현재 색과 가중치가 함께 고정된다", () => {
  const settings = fixPaletteSlotWeight(configured(2), 0, [90, 80, 70], 2.4);
  assert.deepEqual(settings.slots[0], { fixed: true, color: [90, 80, 70], weight: 2.4, weightMode: "manual" });
  assert.equal(paletteSlotMode(settings.slots[0]), "fixed");
});

test("팔레트 전체 초기화는 색상 수를 유지하고 모든 슬롯을 기본 자동 상태로 되돌린다", () => {
  const settings = configured(3);
  settings.slots = [
    { fixed: true, color: [240, 20, 0], weight: 2.2, weightMode: "manual" },
    { fixed: false, color: [20, 190, 80], weight: 0.8, weightMode: "auto" },
    { fixed: true, color: [30, 70, 230], weight: 1.4, weightMode: "manual" },
  ];
  const reset = resetPaletteSettings(settings);
  assert.equal(reset.colorCount, 3);
  assert.equal(reset.slots.length, 3);
  assert.ok(reset.slots.every((slot) => slot.fixed === false && slot.color === null && slot.weight === 1 && slot.weightMode === "auto"));
});

test("잘못된 설정 파일은 예외로 보고하고 프로세스를 종료하지 않는다", () => {
  assert.throws(() => deserializeSettings("{not-json"), /JSON/);
  const invalid = defaultSettings();
  invalid.slots[0].weight = 99;
  assert.throws(() => deserializeSettings(JSON.stringify(invalid)), /가중치/);
});
test("자동 팔레트 성향은 주조색·원본 균형·색상 다양성을 구분한다", () => {
  const colors = [];
  for (let index = 0; index < 6000; index += 1) {
    const ratio = (index % 200) / 199;
    colors.push([120 + Math.round(100 * ratio), 105 + Math.round(80 * ratio), 65 + Math.round(55 * ratio)]);
  }
  for (let index = 0; index < 300; index += 1) colors.push([20 + index % 15, 125 + index % 20, 205 + index % 20]);
  for (let index = 0; index < 130; index += 1) colors.push([235, 150 + index % 15, 65]);
  for (let index = 0; index < 100; index += 1) colors.push([70, 55, 45]);
  for (let index = 0; index < 80; index += 1) colors.push([65, 125, 75]);
  const source = pixels(colors);
  const dominant = configured(5);
  dominant.paletteDiversity = 0;
  const balanced = configured(5);
  const diverse = configured(5);
  diverse.paletteDiversity = 100;
  assert.equal(balanced.paletteDiversity, 50);
  const dominantPalette = quantizeImage(source, dominant, colors.length, 1).palette;
  const balancedOutput = quantizeImage(source, balanced, colors.length, 1);
  const balancedPalette = balancedOutput.palette;
  const diversePalette = quantizeImage(source, diverse, colors.length, 1).palette;
  const hasGreenAccent = (palette) => palette.some(([red, green, blue]) => green > red + 30 && green > blue + 25);
  const distance = (first, second) => (first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2 + (first[2] - second[2]) ** 2;
  const perceptualError = (palette) => {
    const paletteLabs = palette.map(rgbToOklab);
    return colors.reduce((sum, color) => {
      const lab = rgbToOklab(color);
      return sum + Math.min(...paletteLabs.map((paletteLab) => distance(lab, paletteLab)));
    }, 0) / colors.length;
  };
  assert.equal(hasGreenAccent(dominantPalette), false);
  assert.equal(hasGreenAccent(diversePalette), true);
  assert.ok(balancedOutput.weights.some((weight) => weight !== 1));
  assert.ok(perceptualError(balancedPalette) < perceptualError(diversePalette));
  assert.deepEqual(quantizeImage(source, diverse, colors.length, 1).palette, diversePalette);
});
test("색상 다양성은 반투명 희귀색보다 충분한 면적의 서로 다른 강조색을 선택한다", () => {
  const colors = [];
  const add = (count, color, alpha = 255) => {
    for (let index = 0; index < count; index += 1) colors.push([...color, alpha]);
  };
  add(5000, [20, 15, 15]);
  add(2500, [100, 70, 50]);
  add(500, [180, 180, 60]);
  add(300, [160, 40, 50]);
  add(200, [60, 120, 210]);
  add(1000, [255, 0, 255], 2);
  const settings = configured(5);
  settings.paletteDiversity = 100;
  const palette = quantizeImage(pixels(colors), settings, colors.length, 1).palette;
  assert.ok(palette.some(([red, green, blue]) => red > 120 && green > 120 && blue < 100));
  assert.ok(palette.some(([red, green, blue]) => red > green + 70 && red > blue + 60));
  assert.ok(palette.some(([red, green, blue]) => blue > red + 50 && blue > green + 50));
  assert.equal(palette.some(([red, green, blue]) => red > 220 && blue > 220 && green < 40), false);
});
test("자동 팔레트 성향과 면 정리 강도는 PALETTE 설정에 저장되고 이전 파일은 기본값을 사용한다", () => {
  const settings = configured(3);
  settings.paletteDiversity = 72;
  settings.surfaceCleanup = 64;
  const serialized = serializeSettings(settings, ["palette"]);
  const document = JSON.parse(serialized);
  assert.equal(document.paletteDiversity, 72);
  assert.equal(document.surfaceCleanup, 64);
  assert.equal("edgePreservation" in document, false);
  const loaded = deserializeSettingsDocument(serialized, configured(5)).settings;
  assert.equal(loaded.paletteDiversity, 72);
  assert.equal(loaded.surfaceCleanup, 64);
  assert.equal("edgePreservation" in loaded, false);
  delete document.paletteDiversity;
  delete document.surfaceCleanup;
  document.edgePreservation = 64;
  const legacyPalette = deserializeSettingsDocument(JSON.stringify(document), configured(5)).settings;
  assert.equal(legacyPalette.paletteDiversity, 50);
  assert.equal(legacyPalette.surfaceCleanup, 50);
  assert.equal("edgePreservation" in legacyPalette, false);
});

test("자동 팔레트 성향은 0부터 100 사이의 정수만 허용한다", () => {
  const diversity = defaultSettings();
  diversity.paletteDiversity = 101;
  assert.throws(() => deserializeSettings(JSON.stringify(diversity)), /자동 팔레트 성향/);
});

test("면 정리 강도는 0부터 100 사이의 정수만 허용한다", () => {
  const settings = defaultSettings();
  settings.surfaceCleanup = 101;
  assert.throws(() => deserializeSettings(JSON.stringify(settings)), /면 정리 강도/);
});
