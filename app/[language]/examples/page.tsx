import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamplesIndex } from "../../ExamplePages";
import { LOCALIZED_PUBLIC_LANGUAGES, isLocalizedPublicLanguage } from "../../public-locale";
import { publicPageMetadata } from "../../public-metadata";

type PageProps = { params: Promise<{ language: string }> };

export function generateStaticParams() {
  return LOCALIZED_PUBLIC_LANGUAGES.map((language) => ({ language }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { language } = await params;
  if (!isLocalizedPublicLanguage(language)) return {};
  return publicPageMetadata("examples", language, `/${language}/examples`);
}

export default async function LocalizedExamples({ params }: PageProps) {
  const { language } = await params;
  if (!isLocalizedPublicLanguage(language)) notFound();
  return <ExamplesIndex initialLanguage={language} />;
}
