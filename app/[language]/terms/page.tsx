import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InfoPage from "../../InfoPage";
import { LOCALIZED_PUBLIC_LANGUAGES, isLocalizedPublicLanguage } from "../../public-locale";
import { publicPageMetadata } from "../../public-metadata";

type PageProps = { params: Promise<{ language: string }> };
export function generateStaticParams() { return LOCALIZED_PUBLIC_LANGUAGES.map((language) => ({ language })); }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> { const { language } = await params; return isLocalizedPublicLanguage(language) ? publicPageMetadata("terms", language, `/${language}/terms`) : {}; }
export default async function LocalizedTerms({ params }: PageProps) { const { language } = await params; if (!isLocalizedPublicLanguage(language)) notFound(); return <InfoPage kind="terms" initialLanguage={language} />; }
