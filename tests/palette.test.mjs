import assert from "node:assert/strict";
import test from "node:test";
import {
  cloneSettings,
  countUniqueOpaqueColors,
  defaultSettings,
  deserializeSettings,
  deserializeSettingsDocument,
  fixPaletteSlot,
  getExportDimensions,
  hsvToRgb,
  mapPixels,
  parsePaletteWeight,
  pixelatePixels,
  prepareImage,
  quantizeImage,
  rgbToHsv,
  serializeSettings,
} from "../lib/palette.mjs";

function pixels(colors) {
  return new Uint8ClampedArray(colors.flatMap((color) => [color[0], color[1], color[2], color.length === 4 ? color[3] : 255]));
}

function configured(count) {
  const settings = defaultSettings();
  settings.colorCount = count;
  settings.slots = Array.from({ length: count }, () => ({ fixed: false, color: null, weight: 1 }));
  return settings;
}

test("결과의 불투명 RGB 색상 수가 설정값을 넘지 않는다", () => {
  const source = pixels([[255, 0, 0], [230, 20, 10], [0, 255, 0], [0, 0, 255], [20, 20, 220], [255, 255, 0]]);
  const { result } = quantizeImage(source, configured(3));
  assert.ok(countUniqueOpaqueColors(result) <= 3);
});

test("고정 색상은 결과 팔레트에 정확히 포함되고 변경되지 않는다", () => {
  const settings = configured(3);
  settings.slots[1] = { fixed: true, color: [240, 20, 0], weight: 1 };
  const source = pixels([[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
  const first = quantizeImage(source, settings);
  const second = quantizeImage(source, settings);
  assert.deepEqual(first.palette[1], [240, 20, 0]);
  assert.deepEqual(second.palette[1], [240, 20, 0]);
});

test("모든 슬롯이 고정이면 지정 팔레트만 사용한다", () => {
  const settings = configured(2);
  settings.slots = [
    { fixed: true, color: [10, 20, 30], weight: 1 },
    { fixed: true, color: [220, 230, 240], weight: 1 },
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

test("가중치 입력은 편집 중간 상태와 유효한 소수를 구분한다", () => {
  assert.equal(parsePaletteWeight(""), null);
  assert.equal(parsePaletteWeight("0."), null);
  assert.equal(parsePaletteWeight("0.5"), 0.5);
  assert.equal(parsePaletteWeight("0.4"), 0.4);
  assert.equal(parsePaletteWeight("5"), 5);
  assert.equal(parsePaletteWeight("0.09"), null);
  assert.equal(parsePaletteWeight("5.1"), null);
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
  settings.slots[0] = { fixed: true, color: [240, 20, 0], weight: 1.7 };
  settings.adjustments.hue = 25;
  settings.pixelation = { enabled: true, size: 12, alphaMode: "binary" };
  settings.export.keepOriginalSize = false;
  assert.deepEqual(deserializeSettings(serializeSettings(settings)), settings);
});

test("ADJUST 전용 설정은 현재 팔레트를 유지하면서 보정과 픽셀화를 적용한다", () => {
  const saved = configured(2);
  saved.adjustments = { brightness: 21, contrast: -14, saturation: 37, hue: 48 };
  saved.pixelation = { enabled: true, size: 9, alphaMode: "binary" };
  saved.export.fileName = "adjust-preset";
  const current = configured(4);
  current.slots[1] = { fixed: true, color: [12, 34, 56], weight: 2.2 };

  const serialized = serializeSettings(saved, ["adjust"]);
  const document = JSON.parse(serialized);
  assert.equal("colorCount" in document, false);
  assert.equal("slots" in document, false);
  const loaded = deserializeSettingsDocument(serialized, current);
  assert.deepEqual(loaded.includedSections, ["adjust"]);
  assert.deepEqual(loaded.settings.adjustments, saved.adjustments);
  assert.deepEqual(loaded.settings.pixelation, saved.pixelation);
  assert.equal(loaded.settings.colorCount, current.colorCount);
  assert.deepEqual(loaded.settings.slots, current.slots);
  assert.deepEqual(loaded.settings.export, saved.export);
});

test("PALETTE 전용 설정은 현재 보정을 유지하면서 팔레트를 적용한다", () => {
  const saved = configured(3);
  saved.slots[0] = { fixed: true, color: [240, 20, 0], weight: 1.8 };
  saved.slots[1] = { fixed: false, color: [20, 190, 80], weight: 0.7 };
  saved.slots[2] = { fixed: false, color: [30, 70, 230], weight: 2.4 };
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
    { fixed: true, color: [11, 22, 33], weight: 1 },
    { fixed: true, color: [210, 220, 230], weight: 1.5 },
  ]);
});

test("범위 정보가 없는 기존 설정 파일은 전체 설정으로 불러온다", () => {
  const legacy = configured(2);
  legacy.adjustments.brightness = 33;
  legacy.slots[0] = { fixed: true, color: [1, 2, 3], weight: 1.4 };
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

test("고정 색상을 연속 추가해도 팔레트 슬롯 수는 줄지 않는다", () => {
  let settings = configured(5);
  settings = fixPaletteSlot(settings, 0, [240, 20, 0]);
  settings = fixPaletteSlot(settings, 1, [20, 190, 80]);
  settings = fixPaletteSlot(settings, 2, [30, 70, 230]);
  assert.equal(settings.colorCount, 5);
  assert.equal(settings.slots.length, 5);
  assert.equal(settings.slots.filter((slot) => slot.fixed).length, 3);
  assert.deepEqual(settings.slots.slice(0, 3).map((slot) => slot.color), [[240, 20, 0], [20, 190, 80], [30, 70, 230]]);
});

test("잘못된 설정 파일은 예외로 보고하고 프로세스를 종료하지 않는다", () => {
  assert.throws(() => deserializeSettings("{not-json"), /JSON/);
  const invalid = defaultSettings();
  invalid.slots[0].weight = 99;
  assert.throws(() => deserializeSettings(JSON.stringify(invalid)), /가중치/);
});
