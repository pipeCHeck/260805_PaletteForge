import type { MetadataRoute } from "next";
import { EXAMPLE_STORIES } from "./site-content";
import { PUBLIC_LANGUAGES, localizedPublicPath } from "./public-locale";

const SITE_URL = "https://paletteforge.org";
const LAST_MODIFIED = new Date("2026-08-18T00:00:00+09:00");

const PATHS = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/examples", priority: 0.9, changeFrequency: "weekly" as const },
  ...EXAMPLE_STORIES.map(({ slug }) => ({ path: `/examples/${slug}`, priority: 0.8, changeFrequency: "monthly" as const })),
  { path: "/guide", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.4, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.flatMap(({ path, priority, changeFrequency }) => {
    const languages = Object.fromEntries(PUBLIC_LANGUAGES.map((language) => [language, `${SITE_URL}${localizedPublicPath(language, path)}`]));
    return PUBLIC_LANGUAGES.map((language) => ({
      url: `${SITE_URL}${localizedPublicPath(language, path)}`,
      lastModified: LAST_MODIFIED,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  });
}
