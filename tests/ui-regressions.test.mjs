import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("고정 팔레트 행은 Tailwind의 fixed 위치 유틸리티와 충돌하지 않는다", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /slot\.fixed \? "is-fixed"/);
  assert.doesNotMatch(component, /slot\.fixed \? "fixed"/);
  assert.match(css, /\.palette-slot\.is-fixed/);
  assert.doesNotMatch(css, /\.palette-slot\.fixed/);
});

test("이미지 미리보기는 휠 확대와 포인터 드래그 및 초기화를 제공한다", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /addEventListener\("wheel", zoomWithWheel, \{ passive: false \}\)/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /event\.stopPropagation\(\)/);
  assert.match(component, /onPointerMove=\{moveDrag\}/);
  assert.match(component, /화면 맞춤/);
  assert.match(css, /\.pan-zoom-viewport/);
});

test("팔레트 슬롯 창은 위치 제어가 가능한 내장 색상 선택기를 제공한다", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className="color-picker-area"/);
  assert.match(component, /className="hue-slider"/);
  assert.doesNotMatch(component, /showPicker\(\)/);
  assert.match(css, /\.color-picker-area \{[^}]*border:\s*0;[^}]*outline:\s*0;/);
});

test("색 보정 패널은 픽셀화 온오프, 블록 크기, 알파 방식을 제공한다", async () => {
  const component = await readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8");
  assert.match(component, /className="pixelation-toggle"/);
  assert.match(component, /settings\.pixelation\.enabled/);
  assert.match(component, /settings\.pixelation\.size/);
  assert.match(component, /settings\.pixelation\.alphaMode/);
  assert.match(component, /value="binary"/);
  assert.match(component, /settings\.export\.keepOriginalSize/);
  assert.match(component, /getExportDimensions/);
});

test("설정 패널의 작은 숫자와 보조 정보는 읽을 수 있는 크기를 유지한다", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.pixelation-size output \{[^}]*min-height: 24px;[^}]*font: 11px/);
  assert.match(css, /\.weight span \{[^}]*font-size: 9px/);
  assert.match(css, /\.slot-color small \{[^}]*font-size: 9px/);
});
