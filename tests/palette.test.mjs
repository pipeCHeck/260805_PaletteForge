import assert from "node:assert/strict";
import test from "node:test";
import {
  cloneSettings,
  countUniqueOpaqueColors,
  defaultSettings,
  deserializeSettings,
  mapPixels,
  quantizeImage,
  serializeSettings,
} from "../lib/palette.mjs";

function pixels(colors) {
  return new Uint8ClampedArray(colors.flatMap((color) => [...color, color.length === 4 ? color[3] : 255]).slice(0, colors.length * 4));
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

test("설정 저장 후 불러오면 동일하게 복원된다", () => {
  const settings = configured(2);
  settings.slots[0] = { fixed: true, color: [240, 20, 0], weight: 1.7 };
  settings.adjustments.hue = 25;
  assert.deepEqual(deserializeSettings(serializeSettings(settings)), settings);
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

test("잘못된 설정 파일은 예외로 보고하고 프로세스를 종료하지 않는다", () => {
  assert.throws(() => deserializeSettings("{not-json"), /JSON/);
  const invalid = defaultSettings();
  invalid.slots[0].weight = 99;
  assert.throws(() => deserializeSettings(JSON.stringify(invalid)), /가중치/);
});
