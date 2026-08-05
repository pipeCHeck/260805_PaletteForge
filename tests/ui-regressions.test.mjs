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
  assert.match(css, /\.pixelation-size input\[type="number"\] \{[^}]*min-height: 28px;[^}]*font: 12px/);
  assert.match(css, /\.weight span \{[^}]*font-size: 10px/);
  assert.match(css, /\.slot-color small \{[^}]*font-size: 10px/);
});

test("픽셀화 블록 크기는 편집 중 빈 값을 허용하는 숫자 입력을 제공한다", async () => {
  const component = await readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8");
  assert.match(component, /pixelSizeDrafts/);
  assert.match(component, /aria-label="픽셀화 블록 크기 숫자"/);
  assert.match(component, /onBlur=\{commitPixelSize\}/);
  assert.match(component, /픽셀화 블록 크기는 2~64 사이의 정수여야 합니다/);
});

test("보정 미리보기와 이미지 스포이드는 실제 전처리 픽셀을 함께 사용한다", async () => {
  const [component, worker] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/quantize.worker.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /operation: "prepare"/);
  assert.match(component, /const sampled = displayedPixels\.current/);
  assert.match(component, /onPick\(sampled\[index \+ 3\]/);
  assert.doesNotMatch(component, /brightness\(\$\{/);
  assert.match(worker, /event\.data\.operation === "prepare"/);
  assert.match(worker, /prepareImage\(pixels/);
});

test("미리보기 Worker 처리 중 진행 상태를 화면에 표시한다", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /미리보기 계산 중…/);
  assert.match(component, /aria-busy=\{isPreparing\}/);
  assert.match(component, /previewStatus/);
  assert.match(component, /220 - \(performance\.now\(\) - startedAt\)/);
  assert.match(css, /\.preview-processing/);
  assert.match(css, /@keyframes preview-spin/);
});

test("zoomed preview preserves canvas clicks until a drag actually begins", async () => {
  const component = await readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8");
  assert.match(component, /<canvas ref=\{ref\} onClick=\{click\}/);
  assert.match(component, /if \(!moved\.current && Math\.abs\(dx\) \+ Math\.abs\(dy\) > 3\)/);
  assert.match(component, /event\.currentTarget\.setPointerCapture\(event\.pointerId\)/);
  assert.match(component, /event\.clientX < rect\.left/);
  assert.match(component, /event\.clientY < rect\.top/);
  assert.doesNotMatch(component, /startY: event\.clientY[^}]+setPointerCapture/s);
});

test("compact control typography uses consistent readable sizing and alignment", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.sliders output \{[^}]*text-align: center;/);
  assert.match(css, /\.pixelation-size > div \{[^}]*font-size: 12px;/);
  assert.match(css, /\.pixelation-option > span \{[^}]*font-size: 12px;/);
  assert.match(css, /\.pixelation-help \{[^}]*font-size: 10px;/);
  assert.match(css, /\.export-grid label > span,[^}]*font-size: 10px;/);
});
