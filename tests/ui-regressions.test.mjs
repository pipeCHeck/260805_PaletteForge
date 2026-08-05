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
  assert.match(component, /onWheel=\{zoomWithWheel\}/);
  assert.match(component, /onPointerMove=\{moveDrag\}/);
  assert.match(component, /화면 맞춤/);
  assert.match(css, /\.pan-zoom-viewport/);
});
