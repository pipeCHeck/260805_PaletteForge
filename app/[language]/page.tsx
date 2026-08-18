import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LandingPage from "../LandingPage";
import { LOCALIZED_PUBLIC_LANGUAGES, isLocalizedPublicLanguage } from "../public-locale";
import { publicPageMetadata } from "../public-metadata";

type PageProps = { params: Promise<{ language: string }> };

export function generateStaticParams() {
  return LOCALIZED_PUBLIC_LANGUAGES.map((language) => ({ language }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { language } = await params;
  if (!isLocalizedPublicLanguage(language)) return {};
  return publicPageMetadata("home", language, `/${language}`);
}

export default async function LocalizedHome({ params }: PageProps) {
  const { language } = await params;
  if (!isLocalizedPublicLanguage(language)) notFound();
  return <>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2402421786391581" crossOrigin="anonymous" />
    <LandingPage initialLanguage={language} />
  </>;
}
