import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("video converter does not inherit the selected image settings", async () => {
  const [studio, converter] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/VideoConverter.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(studio, /seedSettings=/);
  assert.doesNotMatch(converter, /seedSettings/);
  assert.match(converter, /useState<Settings>\(\(\) => createDefaultVideoSettings\(\)\)/);
});

test("고정 팔레트 행은 Tailwind의 fixed 위치 유틸리티와 충돌하지 않는다", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /slot\.fixed \? "is-fixed"/);
  assert.doesNotMatch(component, /slot\.fixed \? "fixed"/);
  assert.match(css, /\.palette-slot\.is-fixed/);
  assert.match(css, /\.image-list \{[^}]*padding: 2px 12px 8px;[^}]*overflow-x: hidden;[^}]*overflow-y: auto;/);
  assert.doesNotMatch(css, /\.image-list \{[^}]*scrollbar-gutter: stable;/);
  assert.match(css, /\.image-item img \{[^}]*object-fit: contain;[^}]*object-position: center;/);
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
  assert.match(component, /const calculateFitZoom = useCallback/);
  assert.match(component, /const \[isFitView, setIsFitView\] = useState\(true\)/);
  assert.match(component, /const \[isViewReady, setIsViewReady\] = useState\(false\)/);
  assert.match(component, /useLayoutEffect\(\(\) => \{[\s\S]*?fitToViewport\(\);[\s\S]*?observer\.observe\(viewport\)/);
  assert.match(component, /isViewReady \? "" : "is-view-initializing"/);
  assert.match(component, /fitToViewport\(\);/);
  assert.match(component, /viewport\.clientWidth \/ item\.width/);
  assert.match(component, /viewport\.clientHeight \/ item\.height/);
  assert.match(component, /if \(isFitView\) showActualSize\(\)/);
  assert.match(component, /tr\(isFitView \? "화면 맞춤" : "100%로 보기"\)/);
  assert.match(component, /width: `\$\{item\.width\}px`/);
  assert.match(component, /height: `\$\{item\.height\}px`/);
  assert.match(css, /\.pan-zoom-viewport \{[^}]*inset: 0;/);
  assert.match(css, /\.pan-zoom-viewport canvas \{[^}]*max-width:none;[^}]*max-height:none;[^}]*image-rendering:pixelated;/);
  assert.match(css, /\.pan-zoom-viewport\.is-view-initializing canvas \{[^}]*visibility: hidden;[^}]*transition: none;/);
});

test("empty automatic slots open the picker with the same DADAD5 color shown in the list", async () => {
  const component = await readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8");
  assert.match(component, /const DEFAULT_SLOT_COLOR: RGB = \[218, 218, 213\]/);
  assert.match(component, /function getPaletteSlotColor/);
  assert.match(component, /const color = getPaletteSlotColor\(current, index\);[\s\S]*?setActiveSlot\(index\)/);
  assert.match(component, /const color = getPaletteSlotColor\(current, index\); const hex = rgbToHex/);
  assert.doesNotMatch(component, /current\.settings\.slots\[index\]\.color \?\? current\.palette\[index\] \?\? \[0, 0, 0\]/);
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

test("색 보정 패널은 단일 색상화와 픽셀화 설정을 제공한다", async () => {
  const [component, video] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/VideoConverter.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className="colorize-toggle"/);
  assert.match(component, /settings\.colorize\.enabled/);
  assert.match(component, /주요 색상 계열로 통일 · 색조로 계열 변경/);
  assert.doesNotMatch(component, /settings\.colorize\.color/);
  assert.doesNotMatch(video, /settings\.colorize\.color/);
  assert.doesNotMatch(component, /단일 색상화 기준 색상/);
  assert.doesNotMatch(video, /단일 색상화 기준 색상/);
  assert.match(component, /className="pixelation-toggle"/);
  assert.match(component, /settings\.pixelation\.enabled/);
  assert.match(component, /current\?\.settings\.pixelation\.enabled && <div id="image-pixelation-details" className="pixelation-details">/);
  assert.match(component, /settings\.pixelation\.size/);
  assert.match(component, /settings\.pixelation\.alphaMode/);
  assert.match(component, /value="binary"/);
  assert.match(component, /settings\.export\.keepOriginalSize/);
  assert.match(component, /getExportDimensions/);
});

test("설정 패널의 작은 숫자와 보조 정보는 읽을 수 있는 크기를 유지한다", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.compact-number-input \{[^}]*min-height: 28px;[^}]*font-family: inherit;[^}]*font-size: 12px/);
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

test("원본 미리보기는 우하단에서 원본과 보정 화면을 즉시 전환한다", async () => {
  const [component, css, translations] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /const \[showAdjusted, setShowAdjusted\] = useState\(\(\) => result \|\| !item\.isExample\)/);
  assert.match(component, /isExample\?: boolean/);
  assert.match(component, /if \(!showAdjusted\) \{\s*draw\(item\.original\)/);
  assert.match(component, /className="preview-mode-toggle" role="group"/);
  assert.match(component, /setShowAdjusted\(false\).*setShowAdjusted\(true\)/s);
  assert.match(component, /const adjustmentPreviewSignature = JSON\.stringify/);
  assert.match(component, /previousAdjustmentPreviewSignature\.current === adjustmentPreviewSignature/);
  assert.match(component, /if \(previewModeLocked\) return;/);
  assert.match(component, /requestAnimationFrame\(\(\) => setShowAdjusted\(true\)\)/);
  assert.match(component, /const \[previewModeLocked, setPreviewModeLocked\] = useState\(false\)/);
  assert.match(component, /className="preview-mode-lock"/);
  assert.match(component, /className="preview-mode-choice"/);
  assert.match(component, /className="preview-mode-divider"/);
  assert.match(component, /className="preview-lock-glyph"/);
  assert.doesNotMatch(component, /🔒|🔓/);
  assert.match(component, /setPreviewModeLocked\(\(locked\) => !locked\)/);
  assert.match(css, /\.preview-mode-toggle \.preview-mode-lock/);
  assert.match(css, /\.preview-lock-glyph::before/);
  assert.match(css, /\.preview-mode-lock\[aria-pressed="false"\] \.preview-lock-glyph::before/);
  assert.match(css, /\.preview-mode-lock\[aria-pressed="false"\] \.preview-lock-glyph::before \{[^}]*left: 5px;[^}]*border-radius: 0 4px 0 0;[^}]*transform: none;/);
  assert.match(css, /\.preview-mode-choice button\[aria-pressed="true"\]/);
  assert.match(css, /\.preview-mode-toggle \.preview-mode-lock\[aria-pressed="true"\]/);
  assert.match(css, /\.preview-control-bar \{[^}]*right: 8px;[^}]*bottom: 8px;/);
  assert.doesNotMatch(css, /\.preview-mode-toggle button\[aria-pressed="true"\] \{/);
  assert.match(translations, /"원본과 보정 미리보기 전환": "Switch between original and adjusted previews"/);
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
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className="adjustment-number compact-number-input"[\s\S]*?onBlur=\{\(\) => commitAdjustment\(key, label, min, max\)\}/);
  assert.match(css, /\.sliders \.adjustment-number \{[^}]*text-align: right;[^}]*font-family: inherit;[^}]*font-size: 12px;/);
  assert.doesNotMatch(component, /key === "hue" \? "°" : ""/);
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

test("language selector switches and persists Korean, Japanese, English, and Spanish", async () => {
  const [component, translations, spanish, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/es.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /palette-forge-language/);
  assert.match(component, /className="language-control"/);
  assert.match(component, /document\.documentElement\.lang =/);
  assert.match(component, /LANGUAGE_OPTIONS\.map/);
  assert.match(translations, /value: "ko", label: "한국어"/);
  assert.match(translations, /value: "ja", label: "日本語"/);
  assert.match(translations, /value: "en", label: "English"/);
  assert.match(translations, /value: "es", label: "Español"/);
  assert.match(translations, /normalized\.startsWith\("es"\)/);
  assert.match(component, /savedLanguage === "es"/);
  assert.match(translations, /ES_BY_ENGLISH/);
  assert.match(spanish, /"Final palette": "Paleta final"/);
  assert.match(spanish, /"Video palette conversion": "Conversión de paleta de vídeo"/);
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

test("image rail accepts files and supported web images by drag and drop", async () => {
  const [component, translations, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className=\{`studio-shell[\s\S]*?onDragEnter=\{dragImagesIn\}[\s\S]*?onDrop=\{dropImages\}/);
  assert.match(component, /global-image-drop[\s\S]*?사이트 어디든 놓아서 이미지 추가/);
  assert.match(component, /Array\.from\(event\.dataTransfer\.files\)/);
  assert.match(component, /droppedImageUrls\(event\.dataTransfer\)/);
  assert.match(component, /getData\("DownloadURL"\)/);
  assert.match(component, /data-iurl[\s\S]+data-original[\s\S]+data-src/);
  assert.match(component, /querySelectorAll\("a\[href\]"\)/);
  assert.match(component, /for \(const source of sources\)/);
  assert.match(component, /fetch\(url\.href\)/);
  assert.match(component, /void loadImageFiles\(files\)/);
  assert.match(translations, /파일 또는 웹 이미지를 여기로 드래그/);
  assert.match(css, /\.image-rail\.drag-active/);
});

test("opening the editor loads one random bundled example with its settings and converts it", async () => {
  const [component, translations, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /const EXAMPLE_ASSETS = \[/);
  const exampleIds = [...component.matchAll(/id: "(example-\d{2})"/g)].map((match) => match[1]);
  assert.equal(exampleIds.length, 8);
  assert.ok(!exampleIds.includes("example-02"));
  assert.ok(exampleIds.includes("example-09"));
  assert.match(component, /crypto\.getRandomValues\(new Uint32Array\(1\)\)/);
  assert.match(component, /fetch\(`\/examples\/\$\{example\.id\}\.png`\)/);
  assert.match(component, /fetch\(`\/examples\/\$\{example\.id\}\.json`\)/);
  assert.match(component, /deserializeSettingsDocument\(settingsText, defaultSettings\(\)\)/);
  assert.match(component, /isExample: true/);
  assert.match(component, /exampleTitle: example\.name/);
  assert.match(component, /getImageDisplayName\(image, language\)/);
  assert.match(component, /getImageDisplayName\(current, language\)/);
  assert.match(translations, /"별빛을 품은 마녀": "星を抱く魔女"/);
  assert.match(translations, /"별빛을 품은 마녀": "Witch of Starlight"/);
  assert.match(translations, /"예시 · \{name\}": "Example · \{name\}"/);
  assert.match(component, /const converted = await convertOne\(source\)/);
  assert.match(component, /const \[exampleLoading, setExampleLoading\] = useState\(true\)/);
  assert.match(component, /className="example-loading" role="status" aria-live="polite"/);
  assert.match(component, /setExampleLoading\(false\)/);
  assert.match(translations, /"예시 이미지 준비 중": "Preparing example image"/);
  assert.match(css, /\.example-loading-preview \{[^}]*aspect-ratio: 16 \/ 10;/);
  assert.match(css, /\.example-loading-preview i \{[^}]*left: calc\(50% - 8px\);[^}]*top: calc\(50% - 53px\);/);
  assert.match(css, /@keyframes example-loading-sweep/);
  assert.match(component, /setImages\(\[converted\]\)/);
  assert.match(component, /setImages\(\(items\) => \[\.\.\.items, \.\.\.loaded\]\)/);
  assert.match(component, /setSelectedId\(loaded\[0\]\.id\)/);
  assert.doesNotMatch(component, /items\.filter\(\(item\) => item\.id !== exampleId\)/);
  const exampleFiles = await Promise.all(exampleIds.map((id) => {
    return Promise.all([
      readFile(new URL(`../public/examples/${id}.png`, import.meta.url)),
      readFile(new URL(`../public/examples/${id}.json`, import.meta.url), "utf8"),
    ]);
  }));
  for (const [image, settings] of exampleFiles) {
    assert.ok(image.length > 1000);
    assert.equal(JSON.parse(settings).version, 1);
  }
  assert.equal(JSON.parse(exampleFiles[exampleIds.indexOf("example-07")][1]).pixelation.size, 5);
  const marketSettings = JSON.parse(exampleFiles[exampleIds.indexOf("example-09")][1]);
  assert.equal(marketSettings.colorCount, 12);
  assert.equal(marketSettings.adjustments.hue, -103);
  assert.equal(marketSettings.colorize.enabled, true);
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
  assert.match(component, /원본 이미지와 영상은 이 브라우저 밖으로 나가지 않습니다/);
  assert.match(component, /guide\.steps\.map/);
  assert.match(component, /이미지와 영상의 색을 원하는 스타일로 다시 설계하세요/);
  assert.match(component, /画像と動画の色を、思いどおりのスタイルへ/);
  assert.match(component, /Reshape the colors of images and videos/);
  assert.match(component, /Rediseña los colores de tus imágenes y vídeos/);
  assert.match(component, /공통 팔레트/);
  assert.match(component, /フレーム別モード/);
  assert.match(component, /Per-frame mode/);
  assert.match(component, /modo por fotograma/);
  assert.match(component, /github\.com\/pipeCHeck\/260805_PaletteForge\/issues/);
  assert.match(component, /Google AdSense와 광고 쿠키/);
  assert.match(component, /미디어와 권리/);
  assert.match(studio, /className="studio-footer"/);
  assert.match(guideRoute, /kind="guide"/);
  assert.match(privacyRoute, /kind="privacy"/);
  assert.match(termsRoute, /kind="terms"/);
  assert.match(css, /\.guide-grid/);
  assert.match(css, /\.process-flow/);
});

test("brand and metadata describe current image, video, palette, and pixel features", async () => {
  const studio = await readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const translations = await readFile(new URL("../app/i18n.ts", import.meta.url), "utf8");

  assert.match(studio, /이미지와 영상을 팔레트·픽셀 스타일로 변환하는 브라우저 도구/);
  assert.match(layout, /이미지·영상 팔레트 변환/);
  assert.match(layout, /색상 제한, 고정 팔레트, 색 보정과 픽셀화/);
  assert.match(translations, /A browser tool for transforming images and videos with palettes and pixel styles/);
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

test("ad infrastructure remains available but renders no boxes or ad requests before approval", async () => {
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
  assert.match(placement, /const ADVERTISING_ENABLED = false/);
  assert.match(placement, /if \(!ADVERTISING_ENABLED \|\| !slot \|\| initialized\.current\) return/);
  assert.match(placement, /if \(!ADVERTISING_ENABLED\) return null/);
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

test("medium desktop preview gives the canvas the full available viewport", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width:761px\) and \(max-width:1599px\)/);
  assert.match(css, /\.image-rail, \.preview-panel \{[^}]*height:calc\(100dvh - 140px\);[^}]*min-height:0;[^}]*max-height:calc\(100dvh - 140px\);/);
  assert.match(css, /\.image-rail, \.preview-panel \{ position:sticky; top:128px; \}/);
  assert.match(css, /\.image-rail, \.preview-panel \{ position:static; top:auto; \}/);
  assert.match(css, /\.canvas-wrap \{[^}]*padding: 0;/);
  assert.match(css, /\.pan-zoom-viewport \{[^}]*inset: 0;/);
});

test("medium desktop notice follows the preview panels through their shared release point", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /ref=\{noticeRef\} className=\{`notice/);
  assert.match(component, /ref=\{workspaceRef\} className="workspace"/);
  assert.match(component, /workspace\.getBoundingClientRect\(\)\.bottom - panelReleaseLine/);
  assert.match(component, /--notice-release-offset/);
  assert.match(css, /\.notice \{[^}]*position:sticky;[^}]*top:78px;[^}]*--notice-release-offset/);
  assert.match(css, /\.image-rail, \.preview-panel \{ position:sticky; top:128px; \}/);
});
test("wide desktop editor fits its primary regions into one viewport", async () => {
  const [studio, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /<main className=\{`studio-shell/);
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
test("palette panel exposes a centered, editable automatic palette tendency control", async () => {
  const [component, css, translations] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className="palette-tuning"/);
  assert.match(component, /className="palette-tendency-number compact-number-input"/);
  assert.match(component, /aria-label=\{tr\("자동 팔레트 성향 숫자"\)\}/);
  assert.match(component, /paletteTendencyDrafts\[current\.id\].*String\(current\.settings\.paletteDiversity - 50\)/);
  assert.match(component, /settings\.paletteDiversity = tendency \+ 50/);
  assert.match(component, /settings\.paletteDiversity = Number\(event\.target\.value\) \+ 50/);
  assert.match(component, /aria-label=\{tr\("자동 팔레트 성향"\)\} min="-50" max="50"/);
  assert.match(component, /\(current\?\.settings\.paletteDiversity \?\? 50\) - 50/);
  assert.match(component, /tr\("주조색 우선"\).*tr\("원본 균형"\).*tr\("색상 다양성"\)/);
  assert.match(component, /className="surface-cleanup-number compact-number-input"/);
  assert.match(component, /aria-label=\{tr\("면 정리 강도"\)\} min="0" max="100"/);
  assert.match(component, /current\?\.settings\.surfaceCleanup \?\? 50/);
  assert.match(component, /settings\.surfaceCleanup = strength/);
  assert.match(component, /tr\("디테일 유지"\).*tr\("균형"\).*tr\("깔끔한 면"\)/);
  assert.doesNotMatch(component, /edgePreservation|경계 보존/);
  assert.match(css, /.palette-tuning \{/);
  assert.match(css, /\.compact-number-input \{[^}]*width: 60px;[^}]*min-height: 28px;[^}]*text-align: right;[^}]*font-family: inherit;[^}]*font-size: 12px/);
  assert.match(css, /.palette-list \{[^}]*scrollbar-gutter: stable;/);
  assert.match(css, /.weight span \{[^}]*white-space: nowrap;/);
  assert.match(css, /grid-template-columns: 38px minmax\(0,1fr\) auto 72px 22px;/);
  assert.match(component, /mode === "auto" \? "자동" : mode === "color-fixed" \? "색 고정" : "고정"/);
  assert.match(component, /cyclePaletteSlotMode\(settings, index, color\)/);
  assert.match(component, /fixPaletteSlotWeight\(settings, index, color, weight\)/);
  assert.doesNotMatch(component, /className="reset-slot"/);
  assert.match(css, /\.delete-slot \{[^}]*width: 22px;[^}]*border: 0;[^}]*background: transparent;/);
  assert.match(translations, /"자동 팔레트 성향": "Automatic palette tendency"/);
  assert.match(translations, /"자동 팔레트 성향 숫자": "Automatic palette tendency number"/);
  assert.match(translations, /"면 정리 강도": "Surface cleanup"/);
  assert.doesNotMatch(translations, /"경계 보존": "Preserve edges"/);
});

test("palette presets preview useful color sets and apply them as fixed slots", async () => {
  const [component, css, translations] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /const PALETTE_PRESETS/);
  assert.match(component, /id: "gameboy"/);
  assert.match(component, /id: "gameboy"[\s\S]*?colors: \["#252525", "#0F380F", "#306230", "#8BAC0F", "#9BBC0F"\]/);
  assert.match(component, /id: "earth"[\s\S]*?colors: \["#2A1A16", "#4A2A22", "#6B3E2E", "#A8643A", "#C47A46", "#D89B5B", "#E8C78D", "#F4E8CE"\]/);
  assert.match(component, /id: "ocean"[\s\S]*?colors: \["#071D2B", "#0B3C5D", "#0E5E78", "#167D9A", "#45B8AC", "#70CFBE", "#A8E6CF", "#EAF9F3"\]/);
  assert.match(component, /id: "sunset"[\s\S]*?colors: \["#2D1B46", "#6A275B", "#8E2F58", "#B23A48", "#F06449", "#F47A4B", "#F7A35C", "#FFD7A0"\]/);
  assert.doesNotMatch(component, /id: "coral"/);
  assert.match(component, /id: "prism-pop"[\s\S]*?name: "프리즘 팝"[\s\S]*?colors: \["#FFFFFF", "#1E0B20", "#FDE302", "#F89B3F", "#F87D7F", "#EE1436", "#EB1569", "#9C0A64", "#3D195A", "#2D528B", "#23A1C9", "#55DDE9"\]/);
  assert.doesNotMatch(component, /id: "lantern-alley"/);
  assert.match(component, /id: "cosmic-candy"[\s\S]*?name: "코스믹 캔디"[\s\S]*?colors: \["#FFFFFF", "#03053C", "#160252", "#300467", "#2F33A3", "#60A9CE", "#05C9FC", "#BAEE68", "#FEE039", "#F9A77A", "#F46795", "#CF3B96", "#7D0E93"\]/);
  assert.match(component, /id: "amber-ink"[\s\S]*?name: "호박빛 먹선"[\s\S]*?colors: \["#FFFFFF", "#E3E1DE", "#F9D0BB", "#E5A88A", "#E5885E", "#D58A4E", "#F8CA6C", "#B27C6A", "#8A6C52", "#516373", "#575757", "#2C2A2A"\]/);
  assert.match(component, /id: "cyber"[\s\S]*?colors: \["#090A1A", "#2B125C", "#3D2BFF", "#7A04EB", "#FF2BD6", "#00E5FF", "#B7FF00", "#EDD903"\]/);
  assert.match(component, /id: "arcade"/);
  assert.match(component, /setPresetDialogOpen\(true\)/);
  assert.match(component, /className="color-dialog preset-dialog"/);
  assert.match(component, /className="preset-swatches"/);
  assert.match(component, /settings: applyPalettePreset\(item\.settings, colors\)/);
  assert.match(component, /result: null, palette: colors\.map/);
  assert.match(css, /\.preset-grid \{[^}]*grid-template-columns: repeat\(2/);
  assert.match(css, /\.preset-swatches \{[^}]*display: flex;[^}]*height: 34px;/);
  assert.match(translations, /"팔레트 프리셋": "Palette presets"/);
});
test("palette header resets every slot without changing the selected color count", async () => {
  const [component, css, translations] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /const resetPaletteSlots = \(\) =>/);
  assert.match(component, /settings: resetPaletteSettings\(item\.settings\), result: null, palette: \[\]/);
  assert.match(component, /resetPaletteSettings/);
  assert.match(component, /className="palette-title-actions"/);
  assert.match(component, /onClick=\{resetPaletteSlots\}/);
  assert.match(css, /\.palette-title-actions \{[^}]*display: flex;[^}]*align-items: center;/);
  assert.match(translations, /"모든 고정 색상과 가중치 초기화": "Reset all fixed colors and weights"/);
});

test("video palette presets are available and frame mode starts progress at zero", async () => {
  const [component, css, translations] = await Promise.all([
    readFile(new URL("../app/VideoConverter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /const VIDEO_PALETTE_PRESETS/);
  assert.match(component, /id: "gameboy"/);
  assert.match(component, /id: "earth"[\s\S]*?colors: \["#2A1A16", "#4A2A22", "#6B3E2E", "#A8643A", "#C47A46", "#D89B5B", "#E8C78D", "#F4E8CE"\]/);
  assert.match(component, /id: "ocean"[\s\S]*?colors: \["#071D2B", "#0B3C5D", "#0E5E78", "#167D9A", "#45B8AC", "#70CFBE", "#A8E6CF", "#EAF9F3"\]/);
  assert.match(component, /id: "sunset"[\s\S]*?colors: \["#2D1B46", "#6A275B", "#8E2F58", "#B23A48", "#F06449", "#F47A4B", "#F7A35C", "#FFD7A0"\]/);
  assert.doesNotMatch(component, /id: "coral"/);
  assert.match(component, /id: "prism-pop"[\s\S]*?name: "프리즘 팝"[\s\S]*?colors: \["#FFFFFF", "#1E0B20", "#FDE302", "#F89B3F", "#F87D7F", "#EE1436", "#EB1569", "#9C0A64", "#3D195A", "#2D528B", "#23A1C9", "#55DDE9"\]/);
  assert.doesNotMatch(component, /id: "lantern-alley"/);
  assert.match(component, /id: "cosmic-candy"[\s\S]*?name: "코스믹 캔디"[\s\S]*?colors: \["#FFFFFF", "#03053C", "#160252", "#300467", "#2F33A3", "#60A9CE", "#05C9FC", "#BAEE68", "#FEE039", "#F9A77A", "#F46795", "#CF3B96", "#7D0E93"\]/);
  assert.match(component, /id: "amber-ink"[\s\S]*?name: "호박빛 먹선"[\s\S]*?colors: \["#FFFFFF", "#E3E1DE", "#F9D0BB", "#E5A88A", "#E5885E", "#D58A4E", "#F8CA6C", "#B27C6A", "#8A6C52", "#516373", "#575757", "#2C2A2A"\]/);
  assert.match(component, /id: "cyber"[\s\S]*?colors: \["#090A1A", "#2B125C", "#3D2BFF", "#7A04EB", "#FF2BD6", "#00E5FF", "#B7FF00", "#EDD903"\]/);
  assert.match(component, /id: "arcade"/);
  assert.match(component, /applyPalettePreset\(current, colors\)/);
  assert.match(component, /className="video-preset-panel"/);
  assert.match(component, /className="video-slot-mode slot-tag"/);
  assert.match(component, /cyclePaletteSlotMode\(current, index, color\)/);
  assert.match(component, /fixPaletteSlotWeight\(current, index, color, value\)/);
  assert.match(component, /stagedVideoProgress\("conversion", 0\)/);
  assert.match(component, /stagedVideoProgress\("conversion", value\)/);
  assert.match(component, /estimateVideoRemainingTime\(samples, phaseProgressRef\.current\)/);
  assert.match(component, /smoothVideoRemainingTime\(smoothedRemainingRef\.current, rawRemaining\)/);
  assert.match(component, /tr\("경과 시간"\)/);
  assert.doesNotMatch(component, /tr\("단계 경과"\)/);
  assert.match(component, /tr\("남은 예상 시간"\)/);
  assert.match(component, /className="video-progress-value"/);
  assert.match(css, /\.video-progress-meta time, \.video-progress-value \{[^}]*color: var\(--ink\);[^}]*font-weight: 850;/);
  assert.match(component, /remainingTimeLabel/);
  assert.match(translations, /"미리보기 자동 전환 잠금": "Lock automatic preview switching"/);
  assert.match(component, /now - lastRenderedAt < 250/);
  assert.match(component, /context\.drawImage\(source, 0, 0, width, height\)/);
  assert.match(component, /updateLivePreview\(frameCanvas, false/);
  assert.match(component, /className="video-live-preview"/);
  assert.match(component, /const busy = loadingFile \|\| status === "analysis"/);
  assert.match(component, /videoOutputDimensions\(video\.width, video\.height, outputSpec\.codec\)/);
  assert.match(component, /alpha: video\.hasAlpha && outputSpec\.format === "webm" \? "keep" : "discard"/);
  assert.match(component, /new Set\(converted\.palette\.map/);
  assert.match(component, /paletteMode === "frame" \? createFramePaletteSettings\(settings\)/);
  assert.match(component, /const resetVideoAdjustments = \(\) =>/);
  assert.match(component, /const resetVideoPalette = \(\) =>/);
  assert.match(component, /const deleteVideoPaletteSlot = \(index: number\) =>/);
  assert.match(component, /className="video-parameter-number compact-number-input"/);
  assert.match(component, /commitVideoNumber\("paletteTendency", "자동 팔레트 성향", -50, 50\)/);
  assert.match(component, /commitVideoNumber\("surfaceCleanup", "면 정리 강도", 0, 100\)/);
  assert.match(component, /className="video-surface-cleanup"/);
  assert.match(component, /className="video-color-control"/);
  assert.match(component, /<strong>\{hex\}<\/strong><small>RGB \{color\.join\(" · "\)\}<\/small>/);
  assert.match(component, /className="video-delete-slot"/);
  assert.match(component, /className="video-frame-palette-note"/);
  assert.match(component, /disabled=\{busy \|\| paletteMode === "frame"\}/);
  assert.match(css, /\.video-preset-panel \{/);
  assert.match(css, /\.video-slot-list\.is-disabled \{/);
  assert.match(css, /\.video-live-preview-shell \{/);
  assert.match(css, /\.video-slot-color strong/);
  assert.match(css, /\.video-parameter-number\.compact-number-input/);
  assert.match(translations, /"영상 팔레트 프리셋": "Video palette presets"/);
  assert.match(translations, /"프리즘 팝": "Prism pop"/);
  assert.match(translations, /"코스믹 캔디": "Cosmic candy"/);
  assert.doesNotMatch(translations, /"등불 골목": "Lantern alley"/);
  assert.match(translations, /"호박빛 먹선": "Amber ink"/);
  assert.doesNotMatch(translations, /"산호초": "Coral reef"/);
  assert.match(translations, /"마지막 완료 프레임": "Latest completed frame"/);
  assert.match(translations, /"Fixed colors and weights below are ignored in automatic palette-per-frame mode\."/);
});

test("video color adjustments preview the current source frame before conversion", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/VideoConverter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /ref=\{sourceVideoRef\}/);
  assert.match(component, /onLoadedData=\{\(\) => setPreviewFrameVersion/);
  assert.match(component, /onSeeked=\{\(\) => setPreviewFrameVersion/);
  assert.match(component, /onTimeUpdate=\{\(\) => setPreviewFrameVersion/);
  assert.match(component, /prepareWithWorker\(worker, pixels, width, height, settings, videoColorizeBaseHue \?\? undefined\)/);
  assert.match(component, /window\.setTimeout\([\s\S]*?, 100\)/);
  assert.match(component, /is-adjustment-preview/);
  assert.match(component, /최종 팔레트 미적용/);
  assert.match(component, /analyzeVideoColorizeBaseHue/);
  assert.match(component, /createAnalysisTimestamps\(video\.duration, 16\)/);
  assert.match(component, /ensureVideoColorizeBaseHue\(video\)/);
  assert.match(component, /function colorizeHueSignature\(video: VideoInfo\) \{\s*return video\.sourceUrl;/);
  assert.doesNotMatch(component, /colorizeAnalysisAdjustments/);
  assert.match(component, /paletteMode === "frame",\s*colorizeBaseHue/);
  assert.match(component, /영상 전체 색상 기준/);
  assert.match(css, /\.video-live-preview-shell\.is-adjustment-preview\.is-pixelated/);
});

test("image and video palettes can remove one color while preserving at least one slot", async () => {
  const [studio, video, palette] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/VideoConverter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/palette.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(palette, /export function removePaletteSlot\(settings, index\)/);
  assert.match(palette, /normalized\.colorCount -= 1/);
  assert.match(studio, /className="delete-slot"/);
  assert.match(studio, /settings: removePaletteSlot\(item\.settings, index\)/);
  assert.match(video, /setSettings\(\(current\) => removePaletteSlot\(current, index\)\)/);
});

test("main header gives video conversion a prominent responsive entry point", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.ok(component.indexOf("video-open-button") < component.indexOf("theme-toggle"));
  assert.match(component, /className="video-open-icon"[^>]*>▶<\/span>/);
  assert.match(component, /className="video-open-copy"><small>VIDEO<\/small>/);
  assert.match(component, /className="header-action-divider"/);
  assert.match(css, /\.video-open-button \{[^}]*min-height: 46px;[^}]*linear-gradient/);
  assert.match(css, /\.video-open-button \{ width: 42px; min-height: 42px;/);
  assert.doesNotMatch(css, /\.video-open-button \{ display: none; \}/);
});

test("the editor header and information footer display the package version from one shared source", async () => {
  const studio = await readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8");
  const info = await readFile(new URL("../app/InfoPage.tsx", import.meta.url), "utf8");
  const versionModule = await readFile(new URL("../app/version.ts", import.meta.url), "utf8");

  assert.match(versionModule, /packageInfo\.version/);
  assert.match(studio, /className="brand-version"[^>]*>v\{APP_VERSION\}/);
  assert.match(info, /className="app-version"[^>]*>v\{APP_VERSION\}/);
});

test("section help stays at panel headings and supports accessible popovers", async () => {
  const [studio, video, help, css] = await Promise.all([
    readFile(new URL("../app/PaletteStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/VideoConverter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SectionHelp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /section-kicker[^\n]+SOURCE[^\n]+SectionHelp/);
  assert.match(studio, /section-kicker[^\n]+PREVIEW[^\n]+SectionHelp/);
  assert.match(studio, /section-kicker[^\n]+ADJUST[^\n]+SectionHelp/);
  assert.match(studio, /section-kicker[^\n]+PALETTE[^\n]+SectionHelp/);
  assert.match(studio, /section-kicker[^\n]+EXPORT[^\n]+SectionHelp/);
  assert.match(studio, /투명도 방식[^\n]+부드러운 알파는 반투명 픽셀을 유지[^\n]+0·1 알파는 픽셀을 완전 투명/);
  assert.match(studio, /이미지 목록 도움말 열기[^\n]+컴퓨터의 원본 파일은 삭제하지 않습니다/);
  assert.doesNotMatch(studio, /처음 표시되는 예시는 기능을 바로 확인하기 위한 것/);
  assert.match(studio, /스포이드로 색 가져오기[^\n]+이미지 스포이드를 선택하면/);
  assert.doesNotMatch(studio, /이미지 스포이드를 선택한 경우에만/);
  assert.doesNotMatch(studio, /이미지를 클릭하면 해당 픽셀의 색상을 팔레트에 가져올 수 있습니다/);
  assert.match(studio, /색상 수 정하기[^\n]+슬롯의 ×를 누르면 색상 수가 하나 줄어듭니다/);
  assert.match(studio, /색 직접 정하기[^\n]+슬롯 왼쪽 색상 상자를 눌러/);
  assert.match(studio, /프리셋·가중치[^\n]+색 고정·가중치 자동/);
  assert.match(studio, /사이트 어디든 끌어오세요/);
  assert.match(studio, /색 보정과 팔레트 중 필요한 항목을 골라/);
  assert.equal((video.match(/<SectionHelp/g) ?? []).length, 3);
  assert.match(video, /대표 장면을 분석해 같은 팔레트를 끝까지 사용/);
  assert.match(video, /최근 프레임과 자연스럽게 연결/);
  assert.match(video, /색상 수, 팔레트 성향과 면 정리는 계속 적용/);
  assert.match(help, /aria-expanded=\{open\}/);
  assert.match(help, /event\.key !== "Escape"/);
  assert.match(help, /createPortal/);
  assert.match(help, />×<\/button>/);
  assert.doesNotMatch(help, /횞/);
  assert.match(css, /\.section-help-popover \{[^}]*position: fixed;/);
  assert.match(css, /\.section-help-popover \{[^}]*max-height: none;[^}]*overflow: visible;/);
  assert.doesNotMatch(css, /\.section-help-popover \{[^}]*overflow-y: auto;/);
  assert.match(css, /\.section-help-popover li > strong \{[^}]*display: block;/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.section-help-popover/);
});

test("experimental GPU acceleration is guarded and reports CPU fallback", async () => {
  const [converter, gpu, worker] = await Promise.all([
    readFile(new URL("../app/VideoConverter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/gpu-palette.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/quantize.worker.ts", import.meta.url), "utf8"),
  ]);
  assert.match(converter, /type AccelerationMode = "auto" \| "cpu" \| "gpu"/);
  assert.match(converter, /pixelBuffersEqual\(cpuResult\.result, gpuResult\)/);
  assert.match(converter, /CPU로 자동 전환했습니다/);
  assert.match(converter, /paletteMode === "common" && settings\.surfaceCleanup === 0/);
  assert.match(gpu, /device\.lost/);
  assert.match(gpu, /requestAdapter\(\{ powerPreference: "high-performance" \}\)/);
  assert.match(worker, /operation\?: "analyze-hue" \| "prepare" \| "map-fixed" \| "quantize"/);
});
