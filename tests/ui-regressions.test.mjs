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
  assert.match(component, /aria-label=\{tr\("픽셀화 블록 크기 숫자"\)\}/);
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

test("settings save dialog offers independent ADJUST and PALETTE selection", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /saveSections/);
  assert.match(component, /ADJUST · 색 보정/);
  assert.match(component, /PALETTE · 최종 팔레트/);
  assert.match(component, /disabled=\{!saveSections\.adjust && !saveSections\.palette\}/);
  assert.match(component, /deserializeSettingsDocument\(await file\.text\(\), target\.settings\)/);
  assert.match(css, /\.settings-scope-list label\.is-selected/);
});

test("theme toggle switches and persists light and dark modes", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /palette-forge-theme/);
  assert.match(component, /className="button theme-toggle"/);
  assert.match(component, /document\.documentElement\.dataset\.theme/);
  assert.match(component, /aria-pressed=\{theme === "dark"\}/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /\.theme-toggle/);
});

test("language selector switches and persists Korean, Japanese, and English", async () => {
  const [component, translations, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /palette-forge-language/);
  assert.match(component, /className="language-control"/);
  assert.match(component, /document\.documentElement\.lang =/);
  assert.match(component, /LANGUAGE_OPTIONS\.map/);
  assert.match(translations, /value: "ko", label: "한국어"/);
  assert.match(translations, /value: "ja", label: "日本語"/);
  assert.match(translations, /value: "en", label: "English"/);
  assert.match(css, /\.language-control/);
});

test("clipboard image paste uses the existing image loading flow without hijacking text fields", async () => {
  const [component, translations] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /window\.addEventListener\("paste", pasteImages\)/);
  assert.match(component, /item\.kind === "file" && item\.type\.startsWith\("image\/"\)/);
  assert.match(component, /closest\("input, textarea, select, \[contenteditable='true'\]"\)/);
  assert.match(component, /void loadImageFiles\(files, true\)/);
  assert.match(component, /clipboard-\$\{clipboardStamp\}/);
  assert.match(translations, /클립보드에서 \{count\}개 이미지를 불러왔습니다/);
});

test("service guide and legal pages provide clear navigation, local-processing disclosure, and contact", async () => {
  const [component, studio, guideRoute, privacyRoute, termsRoute, css] = await Promise.all([
    readFile(new URL("../app/InfoPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/guide/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/info.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /const COPY: Record<Language, PageCopy>/);
  assert.match(component, /원본 이미지는 이 브라우저 밖으로 나가지 않습니다/);
  assert.match(component, /guide\.steps\.map/);
  assert.match(component, /github\.com\/pipeCHeck\/260805_PaletteForge\/issues/);
  assert.match(component, /Google AdSense와 광고 쿠키/);
  assert.match(component, /이미지와 저작권/);
  assert.match(studio, /className="studio-footer"/);
  assert.match(guideRoute, /kind="guide"/);
  assert.match(privacyRoute, /kind="privacy"/);
  assert.match(termsRoute, /kind="terms"/);
  assert.match(css, /\.guide-grid/);
  assert.match(css, /\.process-flow/);
});

test("information pages use reliable full-document navigation for every internal route", async () => {
  const component = await readFile(new URL("../app/InfoPage.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /from "next\/link"|<Link/);
  assert.match(component, /className="info-brand" href="\/"/);
  assert.match(component, /className="back-editor" href="\/"/);
  assert.match(component, /className="info-primary" href="\/"/);
  assert.match(component, /href="\/guide"/);
  assert.match(component, /href="\/privacy"/);
  assert.match(component, /href="\/terms"/);
  assert.match(component, /href="\/guide#contact"/);
});

test("Korean information typography keeps words intact and balances prominent headings", async () => {
  const css = await readFile(new URL("../app/info.css", import.meta.url), "utf8");
  assert.match(css, /html\[lang="ko"\] \.info-page[^{]+\{ word-break: keep-all;/);
  assert.match(css, /\.info-page :is\(h1,h2,h3\) \{ text-wrap: balance;/);
  assert.match(css, /\.info-page :is\(p,li\) \{ text-wrap: pretty;/);
  assert.match(css, /\.local-promise \{[^}]*grid-template-columns: 150px minmax\(0,1fr\)/);
  assert.match(css, /\.local-promise h2 \{ max-width: 820px;/);
});

test("ad placements reserve policy-aware responsive slots before approval", async () => {
  const [studio, placement, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AdPlacement.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /const AD_SLOTS =/);
  assert.match(studio, /placement="rail"/);
  assert.match(studio, /placement="banner"/);
  assert.match(placement, /data-ad-client=\{ADSENSE_CLIENT\}/);
  assert.match(placement, /data-ad-slot=\{slot\}/);
  assert.match(placement, /data-ad-format=\{placement === "rail" \? "rectangle" : "horizontal"\}/);
  assert.match(placement, /data-full-width-responsive="true"/);
  assert.match(css, /\.ad-placement-rail/);
  assert.match(css, /\.ad-placement-banner/);
  assert.match(css, /\.ad-placement-banner \{[^}]*display:none;/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*\.ad-placement-banner \{[^}]*display:flex;/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*\.ad-placement-rail \{ display:none; \}/);
  assert.match(css, /\.ad-placement \{[^}]*overflow:visible;/);
  assert.match(css, /\.ad-placement-rail \{[^}]*width:calc\(100% - 24px\);[^}]*min-height:282px;/);
  assert.match(css, /adsbygoogle\[data-ad-status="unfilled"\]/);
  assert.equal((studio.match(/placement="rail"/g) ?? []).length, 2);
  assert.match(studio, /railSecondary/);
  assert.match(studio, /label="Advertisements"/);
  assert.match(css, /@media \(min-width:1181px\) and \(min-height:1100px\)[\s\S]*\.rail-ad-secondary \{ display:block; \}/);
});

test("ultrawide layouts keep the central preview at a comfortable width", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.workspace \{[^}]*width:100%;[^}]*max-width:1880px;[^}]*margin:0 auto;/);
  assert.match(css, /grid-template-columns:274px minmax\(430px,1fr\) 370px/);
});

test("medium desktop preview stays within one viewport", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width:761px\) and \(max-width:1599px\)/);
  assert.match(css, /\.preview-panel \{[^}]*height:calc\(100dvh - 140px\);[^}]*min-height:0;[^}]*max-height:calc\(100dvh - 140px\);/);
  assert.match(css, /\.pan-zoom-viewport canvas \{[^}]*max-height:min\(360px,100%\);/);
});

test("wide desktop editor fits its primary regions into one viewport", async () => {
  const [studio, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /<main className="studio-shell">/);
  assert.match(css, /@media \(min-width:1600px\) and \(min-height:900px\)/);
  assert.match(css, /\.studio-shell \{[^}]*height:100dvh;[^}]*grid-template-rows:78px 38px minmax\(0,1fr\) 48px;[^}]*overflow:hidden;/);
  assert.match(css, /\.studio-shell \.control-panel \{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(css, /\.studio-shell \.control-section:nth-child\(2\) \{[^}]*display:flex;[^}]*overflow:hidden;/);
  assert.match(css, /\.studio-shell \.control-section:nth-child\(2\) \.palette-list \{[^}]*flex:1;[^}]*max-height:none;/);
});

test("preview canvas uses an explicit center anchor at medium widths", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /calc\(-50% \+ \$\{view\.x\}px\)/);
  assert.match(component, /calc\(-50% \+ \$\{view\.y\}px\)/);
  assert.match(css, /\.pan-zoom-viewport canvas \{[^}]*position:absolute;[^}]*left:50%;[^}]*top:50%;/);
});
