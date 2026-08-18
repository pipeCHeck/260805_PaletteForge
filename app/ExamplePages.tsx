"use client";

import { PublicFooter, PublicHeader, usePublicPreferences } from "./PublicChrome";
import { type ExampleStory, EXAMPLE_STORIES, PUBLIC_COPY, examplePreviewImage } from "./site-content";
import type { Language } from "./languages";
import { localizedPublicPath } from "./public-locale";

const COPY: Record<Language, {
  eyebrow: string; title: string; lead: string; colors: string; read: string;
  goal: string; method: string; settings: string; brightness: string; contrast: string;
  saturation: string; hue: string; cleanup: string; pixel: string; off: string;
  open: string; back: string; ai: string;
  original: string; result: string;
}> = {
  ko: { eyebrow: "PALETTE CASE STUDIES", title: "변환 사례 살펴보기", lead: "같은 도구라도 팔레트, 가중치와 면 정리에 따라 결과는 크게 달라집니다. 아래 사례에는 실제로 사용한 색과 설정, 선택한 이유를 기록했습니다.", colors: "색", read: "설정과 과정 보기", goal: "변환 목표", method: "설정한 이유", settings: "사용한 설정", brightness: "밝기", contrast: "대비", saturation: "채도", hue: "색조", cleanup: "면 정리", pixel: "픽셀 블록", off: "사용 안 함", open: "이 설정으로 편집기 열기", back: "모든 사례 보기", ai: "이 사례의 원본 이미지는 AI로 생성했으며, 표시된 결과에는 Palette Forge의 실제 설정을 사용했습니다.", original: "원본", result: "변환 결과" },
  ja: { eyebrow: "PALETTE CASE STUDIES", title: "変換事例", lead: "同じ画像でもパレット、重み、面整理によって結果は大きく変わります。各例に実際の色と設定、その理由を記録しました。", colors: "色", read: "設定と過程を見る", goal: "変換の目的", method: "設定した理由", settings: "使用設定", brightness: "明るさ", contrast: "コントラスト", saturation: "彩度", hue: "色相", cleanup: "面整理", pixel: "ピクセルブロック", off: "未使用", open: "この設定でエディターを開く", back: "すべての例を見る", ai: "元画像はAI生成で、表示結果にはPalette Forgeの実際の設定を使用しています。", original: "原画像", result: "変換結果" },
  en: { eyebrow: "PALETTE CASE STUDIES", title: "Conversion case studies", lead: "Palette colors, weights, and surface cleanup can radically change the same source. Every study records the real colors, settings, and reasoning behind its result.", colors: "colors", read: "View settings and process", goal: "Conversion goal", method: "Why these settings", settings: "Settings used", brightness: "Brightness", contrast: "Contrast", saturation: "Saturation", hue: "Hue", cleanup: "Surface cleanup", pixel: "Pixel block", off: "Off", open: "Open this setup in the editor", back: "View all examples", ai: "The source image in this study was AI-generated. The displayed result uses real Palette Forge settings.", original: "Original", result: "Converted" },
  es: { eyebrow: "PALETTE CASE STUDIES", title: "Casos de conversión", lead: "La paleta, los pesos y la limpieza pueden cambiar por completo una misma imagen. Cada caso muestra los colores, ajustes y motivos reales.", colors: "colores", read: "Ver ajustes y proceso", goal: "Objetivo", method: "Motivo de los ajustes", settings: "Ajustes usados", brightness: "Brillo", contrast: "Contraste", saturation: "Saturación", hue: "Matiz", cleanup: "Limpieza", pixel: "Bloque de píxel", off: "Desactivado", open: "Abrir estos ajustes en el editor", back: "Ver todos los casos", ai: "La imagen original se generó con IA. El resultado usa ajustes reales de Palette Forge.", original: "Original", result: "Resultado" },
};

function ExampleCard({ example, language }: { example: ExampleStory; language: Language }) {
  const copy = COPY[language];
  return <article>
    <a className="example-image-link public-checker" href={localizedPublicPath(language, `/examples/${example.slug}`)}><img src={examplePreviewImage(example.resultImage)} alt={example.name[language]} loading="lazy" decoding="async" /><span>{example.colorCount} {copy.colors.toUpperCase()}</span></a>
    <div className="example-card-copy">
      <div className="example-swatches">{example.palette.map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} title={color} />)}</div>
      <h3>{example.name[language]}</h3><p>{example.summary[language]}</p>
      <a href={localizedPublicPath(language, `/examples/${example.slug}`)}>{copy.read}<span>↗</span></a>
    </div>
  </article>;
}

export function ExamplesIndex({ initialLanguage }: { initialLanguage?: Language }) {
  const preferences = usePublicPreferences(initialLanguage);
  const { language } = preferences;
  const copy = COPY[language];
  return <main className="examples-page" lang={language} data-language={language}>
    <PublicHeader {...preferences} />
    <div className="examples-main">
      <header className="examples-intro"><span className="public-eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.lead}</p></header>
      <section className="examples-list" aria-label={copy.title}>{EXAMPLE_STORIES.map((example) => <ExampleCard key={example.id} example={example} language={language} />)}</section>
      <p className="public-ai-note">{PUBLIC_COPY[language].aiNote}</p>
    </div>
    <PublicFooter language={language} />
  </main>;
}

export function ExampleArticle({ example, initialLanguage }: { example: ExampleStory; initialLanguage?: Language }) {
  const preferences = usePublicPreferences(initialLanguage);
  const { language } = preferences;
  const copy = COPY[language];
  const pixelValue = example.pixelation.enabled ? `${example.pixelation.size}px` : copy.off;
  return <main className="example-detail-page" lang={language} data-language={language}>
    <PublicHeader {...preferences} />
    <article className="example-detail-main">
      <header className="example-detail-heading"><span className="public-eyebrow">{copy.eyebrow} · {example.colorCount} {copy.colors.toUpperCase()}</span><h1>{example.name[language]}</h1><p>{example.summary[language]}</p></header>
      <div className="example-detail-grid">
        <div className="example-detail-visual"><div className={`example-before-after example-before-after-${example.orientation}`}><figure className="public-checker"><figcaption>{copy.original}</figcaption><img src={example.image} alt={`${example.name[language]} · ${copy.original}`} /></figure><figure className="public-checker"><figcaption>{copy.result}</figcaption><img src={example.resultImage} alt={`${example.name[language]} · ${copy.result}`} /></figure></div><div className="example-detail-palette">{example.palette.map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} title={color} />)}</div></div>
        <div className="example-detail-copy">
          <section><h2>{copy.goal}</h2><p>{example.goal[language]}</p></section>
          <section><h2>{copy.method}</h2><p>{example.method[language]}</p></section>
          <section><h2>{copy.settings}</h2><ul className="example-setting-list">
            <li><span>{copy.colors}</span><strong>{example.colorCount}</strong></li>
            <li><span>{copy.cleanup}</span><strong>{example.surfaceCleanup}</strong></li>
            <li><span>{copy.brightness}</span><strong>{example.adjustments.brightness}</strong></li>
            <li><span>{copy.contrast}</span><strong>{example.adjustments.contrast}</strong></li>
            <li><span>{copy.saturation}</span><strong>{example.adjustments.saturation}</strong></li>
            <li><span>{copy.hue}</span><strong>{example.adjustments.hue}°</strong></li>
            <li><span>{copy.pixel}</span><strong>{pixelValue}</strong></li>
          </ul></section>
          <p className="public-ai-note">{copy.ai}</p>
          <div className="example-detail-actions"><a href={`/editor?example=${example.id}`}>{copy.open}<span>→</span></a><a href={localizedPublicPath(language, "/examples")}>{copy.back}</a></div>
        </div>
      </div>
    </article>
    <PublicFooter language={language} />
  </main>;
}
