import type { Metadata } from "next";
import type { Language } from "./languages";
import { publicAlternates } from "./public-locale";

export type PublicPageKind = "home" | "examples" | "guide" | "privacy" | "terms";

const COPY: Record<Language, Record<PublicPageKind, { title: string; description: string }>> = {
  ko: {
    home: { title: "Palette Forge | 원하는 색으로 이미지와 영상을 재구성하세요", description: "이미지와 영상의 색을 원하는 팔레트로 재구성합니다. 색 보정, 고정 색상, 팔레트 가중치, 면 정리와 픽셀화를 한 흐름에서 조절하세요." },
    examples: { title: "팔레트 변환 사례", description: "Palette Forge의 실제 팔레트, 색 보정, 픽셀화와 면 정리 설정을 사용한 이미지 변환 사례를 살펴보세요." },
    guide: { title: "사용 가이드", description: "이미지·영상 불러오기부터 색 보정, 픽셀화, 고정 팔레트, 프레임별 영상 변환과 내보내기까지 안내합니다." },
    privacy: { title: "개인정보처리방침", description: "Palette Forge의 로컬 이미지·영상 처리, 브라우저 저장소, 호스팅 및 광고 데이터 처리 안내" },
    terms: { title: "이용약관", description: "Palette Forge 이미지·영상 팔레트 변환 서비스의 이용 조건, 권리 및 책임 범위" },
  },
  ja: {
    home: { title: "Palette Forge | 好きな色で画像と動画を再構成", description: "画像と動画の色を、選んだパレットで再構成します。色補正、固定色、パレットの重み、面整理、ピクセル化を一つの流れで調整できます。" },
    examples: { title: "パレット変換事例", description: "Palette Forgeの実際のパレット、色補正、ピクセル化、面整理の設定を使った変換事例を紹介します。" },
    guide: { title: "使い方ガイド", description: "画像・動画の読み込みから色補正、ピクセル化、固定パレット、フレーム別変換、書き出しまで案内します。" },
    privacy: { title: "プライバシーポリシー", description: "Palette Forgeのローカル処理、ブラウザーストレージ、ホスティング、広告データの取り扱いについて説明します。" },
    terms: { title: "利用規約", description: "Palette Forgeの画像・動画パレット変換サービスに関する利用条件、権利、責任範囲を説明します。" },
  },
  en: {
    home: { title: "Palette Forge | Reimagine images and video with your colors", description: "Reconstruct the colors of images and video with a palette you choose. Tune corrections, fixed colors, palette weights, surface cleanup, and pixelation in one workflow." },
    examples: { title: "Palette conversion case studies", description: "Explore image conversions made with real Palette Forge palettes, color adjustments, pixelation, and surface cleanup settings." },
    guide: { title: "User guide", description: "Learn the full workflow from loading images and video through correction, pixelation, fixed palettes, per-frame conversion, and export." },
    privacy: { title: "Privacy Policy", description: "How Palette Forge handles local media processing, browser storage, hosting data, and advertising data." },
    terms: { title: "Terms of Use", description: "The conditions, rights, and responsibilities for using Palette Forge image and video palette conversion." },
  },
  es: {
    home: { title: "Palette Forge | Recrea imágenes y vídeo con tus colores", description: "Recompone los colores de imágenes y vídeo con la paleta que elijas. Ajusta corrección, colores fijos, pesos, limpieza de superficies y pixelado en un solo flujo." },
    examples: { title: "Casos de conversión de paleta", description: "Explora conversiones hechas con paletas, ajustes de color, pixelado y limpieza de superficies reales de Palette Forge." },
    guide: { title: "Guía de uso", description: "Aprende todo el proceso: cargar imágenes y vídeo, corregir color, pixelar, fijar paletas, convertir fotogramas y exportar." },
    privacy: { title: "Política de privacidad", description: "Cómo gestiona Palette Forge el procesamiento local, el almacenamiento del navegador, el alojamiento y los datos publicitarios." },
    terms: { title: "Términos de uso", description: "Condiciones, derechos y responsabilidades del servicio de conversión de paletas para imágenes y vídeo de Palette Forge." },
  },
};

const OPEN_GRAPH_LOCALE: Record<Language, string> = { ko: "ko_KR", ja: "ja_JP", en: "en_US", es: "es_ES" };

export function publicPageMetadata(kind: PublicPageKind, language: Language, pathname: string): Metadata {
  const copy = COPY[language][kind];
  return {
    title: kind === "home" ? { absolute: copy.title } : copy.title,
    description: copy.description,
    alternates: publicAlternates(pathname, language),
    openGraph: { title: copy.title, description: copy.description, locale: OPEN_GRAPH_LOCALE[language], url: pathname },
    twitter: { card: "summary", title: copy.title, description: copy.description },
  };
}
