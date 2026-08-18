"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_VERSION } from "./version";
import { LANGUAGE_OPTIONS, type Language, detectLanguage } from "./languages";
import { PUBLIC_COPY } from "./site-content";
import { localizedPublicPath } from "./public-locale";

export function usePublicPreferences(initialLanguage?: Language) {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>(initialLanguage ?? "ko");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let storedLanguage: string | null = null;
    let storedTheme: string | null = null;
    try {
      storedLanguage = localStorage.getItem("palette-forge-language");
      storedTheme = localStorage.getItem("palette-forge-theme");
    } catch { /* 브라우저 기본값을 사용합니다. */ }
    const nextLanguage = initialLanguage ?? (storedLanguage === "ko" || storedLanguage === "ja" || storedLanguage === "en" || storedLanguage === "es" ? storedLanguage : detectLanguage(navigator.language));
    const nextTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.lang = nextLanguage;
    document.documentElement.dataset.theme = nextTheme;
    try { localStorage.setItem("palette-forge-language", nextLanguage); } catch { /* 명시된 언어는 계속 유지합니다. */ }
    const timer = window.setTimeout(() => {
      setLanguage(nextLanguage);
      setTheme(nextTheme);
      const targetPath = localizedPublicPath(nextLanguage, pathname);
      if (!initialLanguage && nextLanguage !== "ko" && targetPath !== pathname) window.location.replace(targetPath);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialLanguage, pathname]);

  const chooseLanguage = (next: Language) => {
    setLanguage(next);
    document.documentElement.lang = next;
    try { localStorage.setItem("palette-forge-language", next); } catch { /* 화면 전환은 유지합니다. */ }
    const targetPath = localizedPublicPath(next, pathname);
    if (targetPath !== pathname) window.location.assign(targetPath);
  };
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("palette-forge-theme", next); } catch { /* 화면 전환은 유지합니다. */ }
  };

  return { language, theme, chooseLanguage, toggleTheme };
}

export function PublicHeader({ language, theme, chooseLanguage, toggleTheme, home = false }: ReturnType<typeof usePublicPreferences> & { home?: boolean }) {
  const copy = PUBLIC_COPY[language];
  const homePath = localizedPublicPath(language, "/");
  return <header className="public-header">
    <a className="public-brand" href={homePath} aria-label="Palette Forge">
      <img src="/icon-192.png" alt="" width={46} height={46} />
      <span><strong>Palette Forge</strong><small>v{APP_VERSION}</small></span>
    </a>
    <nav aria-label="Palette Forge">
      <a href={`${home ? "" : homePath}#features`}>{copy.navFeatures}</a>
      <a href={`${home ? "" : homePath}#examples`}>{copy.navExamples}</a>
      <a href={`${home ? "" : homePath}#workflow`}>{copy.navWorkflow}</a>
      <a href={localizedPublicPath(language, "/guide")}>{copy.navGuide}</a>
    </nav>
    <div className="public-actions">
      <button type="button" className="public-theme" onClick={toggleTheme} aria-label={theme === "dark" ? "Light mode" : "Dark mode"}>{theme === "dark" ? "☀" : "☾"}</button>
      <label className="public-language"><span aria-hidden="true">文</span><select value={language} aria-label="Language" onChange={(event) => chooseLanguage(event.target.value as Language)}>{LANGUAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <a className="public-editor-button" href="/editor">{copy.editor}<span>→</span></a>
    </div>
  </header>;
}

export function PublicFooter({ language }: { language: Language }) {
  const copy = PUBLIC_COPY[language];
  return <footer className="public-footer">
    <div><a href={localizedPublicPath(language, "/")} className="public-footer-brand"><img src="/icon-192.png" alt="" width={38} height={38} /><strong>Palette Forge</strong></a><p>{copy.footer}</p></div>
    <nav><a href="/editor">{copy.editor}</a><a href={localizedPublicPath(language, "/examples")}>{copy.navExamples}</a><a href={localizedPublicPath(language, "/guide")}>{copy.navGuide}</a><a href={localizedPublicPath(language, "/privacy")}>Privacy</a><a href={localizedPublicPath(language, "/terms")}>Terms</a></nav>
    <small>© 2026 Palette Forge · v{APP_VERSION}</small>
  </footer>;
}
