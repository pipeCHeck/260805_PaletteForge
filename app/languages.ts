export type Language = "ko" | "ja" | "en" | "es";

export const LANGUAGE_OPTIONS: { value: Language; label: string; shortLabel: string }[] = [
  { value: "ko", label: "한국어", shortLabel: "KO" },
  { value: "ja", label: "日本語", shortLabel: "JA" },
  { value: "en", label: "English", shortLabel: "EN" },
  { value: "es", label: "Español", shortLabel: "ES" },
];

export function detectLanguage(value: string): Language {
  const normalized = value.toLowerCase();
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("ko")) return "ko";
  if (normalized.startsWith("es")) return "es";
  return "en";
}
