import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExampleArticle } from "../../../ExamplePages";
import { EXAMPLE_STORIES, findExample } from "../../../site-content";
import { LOCALIZED_PUBLIC_LANGUAGES, isLocalizedPublicLanguage, publicAlternates } from "../../../public-locale";

type PageProps = { params: Promise<{ language: string; slug: string }> };

export function generateStaticParams() {
  return LOCALIZED_PUBLIC_LANGUAGES.flatMap((language) => EXAMPLE_STORIES.map(({ slug }) => ({ language, slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { language, slug } = await params;
  if (!isLocalizedPublicLanguage(language)) return {};
  const example = findExample(slug);
  if (!example) return {};
  return {
    title: `${example.name[language]} — ${language === "ja" ? "パレット変換事例" : language === "es" ? "Caso de conversión" : "Palette conversion case study"}`,
    description: example.summary[language],
    alternates: publicAlternates(`/examples/${example.slug}`, language),
    openGraph: { title: example.name[language], description: example.summary[language], url: `/${language}/examples/${example.slug}` },
  };
}

export default async function LocalizedExampleDetail({ params }: PageProps) {
  const { language, slug } = await params;
  if (!isLocalizedPublicLanguage(language)) notFound();
  const example = findExample(slug);
  if (!example) notFound();
  return <ExampleArticle example={example} initialLanguage={language} />;
}
