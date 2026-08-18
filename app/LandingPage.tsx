"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { PublicFooter, PublicHeader, usePublicPreferences } from "./PublicChrome";
import { EXAMPLE_STORIES, PUBLIC_COPY, examplePreviewImage, type ExampleStory } from "./site-content";
import type { Language } from "./languages";
import { localizedPublicPath } from "./public-locale";

const FEATURED_IDS = new Set(["example-01", "example-07", "example-09"]);
const HERO_COMPARE_COPY = {
  ko: { original: "원본", result: "변환" },
  ja: { original: "原画像", result: "変換後" },
  en: { original: "Original", result: "Converted" },
  es: { original: "Original", result: "Resultado" },
} as const;

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return <article className={`public-faq-item${open ? " is-open" : ""}`}>
    <h3>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{question}</span><i aria-hidden="true">＋</i>
      </button>
    </h3>
    <div className="public-faq-answer" aria-hidden={!open}><div><p>{answer}</p></div></div>
  </article>;
}

export default function LandingPage({ initialLanguage }: { initialLanguage?: Language }) {
  const preferences = usePublicPreferences(initialLanguage);
  const { language } = preferences;
  const copy = PUBLIC_COPY[language];
  const featured = EXAMPLE_STORIES.filter((example) => FEATURED_IDS.has(example.id));
  const [heroExample, setHeroExample] = useState<ExampleStory | null>(null);
  const heroComparePosition = useRef(15);
  const heroCompareTarget = useRef(15);
  const heroCompareFrame = useRef<number | null>(null);
  const heroCompareCopy = HERO_COMPARE_COPY[language];
  const heroImageFocusClass = heroExample?.id === "example-01"
    ? " hero-image-witch"
    : heroExample?.id === "example-07"
      ? " hero-image-crate"
      : "";

  const moveHeroCompare = (element: HTMLDivElement, target: number) => {
    heroCompareTarget.current = target;
    if (heroCompareFrame.current !== null) return;

    const animate = () => {
      const distance = heroCompareTarget.current - heroComparePosition.current;
      heroComparePosition.current = Math.abs(distance) < .08
        ? heroCompareTarget.current
        : heroComparePosition.current + distance * .32;
      element.style.setProperty("--hero-compare-position", `${heroComparePosition.current}%`);
      if (heroComparePosition.current === 0 || heroComparePosition.current === 100) {
        element.dataset.compareEdge = "true";
      } else {
        delete element.dataset.compareEdge;
      }

      if (heroComparePosition.current === heroCompareTarget.current) {
        heroCompareFrame.current = null;
        return;
      }
      heroCompareFrame.current = window.requestAnimationFrame(animate);
    };

    heroCompareFrame.current = window.requestAnimationFrame(animate);
  };

  const updateHeroCompare = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const rawPosition = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const position = rawPosition < 3 ? 0 : rawPosition > 97 ? 100 : rawPosition;
    moveHeroCompare(element, position);
  };

  const finishHeroCompare = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const edgeZone = Math.min(44, bounds.width * .08);
    if (event.clientX <= bounds.left + edgeZone) {
      moveHeroCompare(event.currentTarget, 0);
    } else if (event.clientX >= bounds.right - edgeZone) {
      moveHeroCompare(event.currentTarget, 100);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const index = Math.floor(Math.random() * EXAMPLE_STORIES.length);
      setHeroExample(EXAMPLE_STORIES[index] ?? EXAMPLE_STORIES[0]);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (heroCompareFrame.current !== null) window.cancelAnimationFrame(heroCompareFrame.current);
    };
  }, []);

  return <main className="public-page" lang={language} data-language={language}>
    <PublicHeader {...preferences} home />
    <section className="public-hero">
      <div className="public-hero-copy">
        <span className="public-eyebrow">{copy.eyebrow}</span>
        <h1><span>{copy.title1}</span><span>{copy.title2}</span></h1>
        <p>{copy.lead}</p>
        <div className="public-hero-actions"><a className="public-primary" href="/editor">{copy.primary}<span>→</span></a><a className="public-secondary" href="#examples">{copy.secondary}</a></div>
        <ul className="public-trust"><li><i>✓</i>{copy.fixed}</li><li><i>✓</i>{copy.local}</li><li><i>✓</i>{copy.video}</li></ul>
      </div>
      <div className="public-hero-demo" aria-label={heroExample?.name[language]} aria-busy={!heroExample}>
        {heroExample ? <>
          <div
            className="hero-image-frame hero-image-compare public-checker"
            style={{ "--hero-compare-position": "15%" } as CSSProperties}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateHeroCompare(event); }}
            onPointerMove={updateHeroCompare}
            onPointerLeave={finishHeroCompare}
            aria-label={`${heroExample.name[language]} · ${heroCompareCopy.original} / ${heroCompareCopy.result}`}
          >
            <img className={`hero-compare-original${heroImageFocusClass}`} src={examplePreviewImage(heroExample.image)} alt="" aria-hidden="true" decoding="async" />
            <img className={`hero-compare-result${heroImageFocusClass}`} src={examplePreviewImage(heroExample.resultImage)} alt={heroExample.name[language]} decoding="async" fetchPriority="high" />
            <span className="hero-compare-divider" aria-hidden="true" />
          </div>
          <div className="hero-badge-layer">
            <span className="hero-compare-label hero-compare-label-original">{heroCompareCopy.original}</span>
            <span className="hero-compare-status">
              <span className="hero-compare-label hero-compare-label-result">{heroCompareCopy.result}</span>
              <span className="hero-local-badge">LOCAL</span>
            </span>
          </div>
          <div className="hero-palette-card">
            <div className="hero-palette-meta"><span><b>{heroExample.colorCount}</b> COLORS</span><small>{heroExample.name[language]}</small></div>
            <div className="hero-palette-swatches">{heroExample.palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div>
          </div>
        </> : <div className="hero-image-frame hero-image-placeholder" aria-hidden="true" />}
      </div>
    </section>

    <section className="public-section public-features" id="features">
      <header><span className="public-eyebrow">{copy.featureEyebrow}</span><h2>{copy.featureTitle}</h2></header>
      <div className="public-feature-grid">{copy.features.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>

    <section className="public-section public-examples" id="examples">
      <header><div><span className="public-eyebrow">{copy.exampleEyebrow}</span><h2>{copy.exampleTitle}</h2><p>{copy.exampleLead}</p></div><a href={localizedPublicPath(language, "/examples")}>{copy.allExamples}<span>→</span></a></header>
      <div className="public-example-grid">{featured.map((example) => <article key={example.id}>
        <a className="example-image-link public-checker" href={localizedPublicPath(language, `/examples/${example.slug}`)}><img src={examplePreviewImage(example.resultImage)} alt={example.name[language]} loading="lazy" decoding="async" /><span>{example.colorCount} COLORS</span></a>
        <div className="example-card-copy"><div className="example-swatches">{example.palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div><h3>{example.name[language]}</h3><p>{example.summary[language]}</p><a href={localizedPublicPath(language, `/examples/${example.slug}`)}>{copy.openCase}<span>↗</span></a></div>
      </article>)}</div>
      <p className="public-ai-note">{copy.aiNote}</p>
    </section>

    <section className="public-section public-workflow" id="workflow">
      <header><span className="public-eyebrow">{copy.workflowEyebrow}</span><h2>{copy.workflowTitle}</h2></header>
      <ol>{copy.workflow.map(([number, title, body]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
    </section>

    <section className="public-section public-guides">
      <header><span className="public-eyebrow">{copy.guideEyebrow}</span><h2>{copy.guideTitle}</h2></header>
      <div className="public-guide-grid">{copy.guides.map(([title, body], index) => <a href={localizedPublicPath(language, "/guide")} key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p><b>→</b></a>)}</div>
      <a className="public-guide-button" href={localizedPublicPath(language, "/guide")}>{copy.guideButton}<span>→</span></a>
    </section>

    <section className="public-section public-faq">
      <header><span className="public-eyebrow">FAQ</span><h2>{copy.faqTitle}</h2></header>
      <div>{copy.faqs.map(([question, answer]) => <FaqItem key={question} question={question} answer={answer} />)}</div>
    </section>

    <section className="public-final-cta"><img src="/icon-192.png" alt="" width={82} height={82} loading="lazy" decoding="async" /><div><span className="public-eyebrow">PALETTE FORGE</span><h2>{copy.title1}<br />{copy.title2}</h2></div><a href="/editor">{copy.primary}<span>→</span></a></section>
    <PublicFooter language={language} />
  </main>;
}
