import type { Metadata } from "next";
import type { Language } from "./languages";

export const LOCALIZED_PUBLIC_LANGUAGES = ["ja", "en", "es"] as const;
export const PUBLIC_LANGUAGES: Language[] = ["ko", ...LOCALIZED_PUBLIC_LANGUAGES];

export function isLanguage(value: string): value is Language {
  return PUBLIC_LANGUAGES.includes(value as Language);
}

export function isLocalizedPublicLanguage(value: string): value is (typeof LOCALIZED_PUBLIC_LANGUAGES)[number] {
  return LOCALIZED_PUBLIC_LANGUAGES.includes(value as (typeof LOCALIZED_PUBLIC_LANGUAGES)[number]);
}

export function stripPublicLanguagePrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && isLocalizedPublicLanguage(segments[0])) segments.shift();
  return `/${segments.join("/")}`;
}

export function localizedPublicPath(language: Language, pathname = "/") {
  const barePath = stripPublicLanguagePrefix(pathname);
  if (language === "ko") return barePath;
  return `/${language}${barePath === "/" ? "" : barePath}`;
}

export function publicAlternates(pathname = "/", canonicalLanguage: Language = "ko"): NonNullable<Metadata["alternates"]> {
  const barePath = stripPublicLanguagePrefix(pathname);
  return {
    canonical: localizedPublicPath(canonicalLanguage, barePath),
    languages: {
      "ko-KR": localizedPublicPath("ko", barePath),
      "ja-JP": localizedPublicPath("ja", barePath),
      en: localizedPublicPath("en", barePath),
      es: localizedPublicPath("es", barePath),
      "x-default": localizedPublicPath("ko", barePath),
    },
  };
}
