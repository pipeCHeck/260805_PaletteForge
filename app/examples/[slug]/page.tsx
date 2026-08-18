import type { Metadata } from "next";
import Link from "next/link";
import { ExampleArticle } from "../../ExamplePages";
import { EXAMPLE_STORIES, findExample } from "../../site-content";
import { publicAlternates } from "../../public-locale";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return EXAMPLE_STORIES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const example = findExample(slug);
  if (!example) return { title: "사례를 찾을 수 없습니다" };
  return {
    title: `${example.name.ko} — 팔레트 변환 사례`,
    description: example.summary.ko,
    alternates: publicAlternates(`/examples/${example.slug}`),
  };
}

export default async function ExampleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const example = findExample(slug);
  if (!example) return <main className="example-detail-page"><div className="example-detail-main"><h1>사례를 찾을 수 없습니다.</h1><Link href="/examples">사례 목록으로 돌아가기</Link></div></main>;
  return <ExampleArticle example={example} />;
}
