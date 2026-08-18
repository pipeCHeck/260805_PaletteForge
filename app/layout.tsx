import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./info.css";
import "./home.css";
import { isLanguage } from "./public-locale";

export const metadata: Metadata = {
  metadataBase: new URL("https://paletteforge.org"),
  title: {
    default: "Palette Forge | 이미지·영상 팔레트 변환",
    template: "Palette Forge | %s",
  },
  description: "이미지와 영상을 색상 제한, 고정 팔레트, 색 보정과 픽셀화로 변환하는 브라우저 기반 로컬 도구",
  applicationName: "Palette Forge",
  authors: [{ name: "Palette Forge" }],
  creator: "Palette Forge",
  openGraph: {
    type: "website",
    siteName: "Palette Forge",
    locale: "ko_KR",
    url: "https://paletteforge.org",
    title: "Palette Forge | 이미지·영상 팔레트 변환",
    description: "원하는 색을 정확히 고정하고 이미지와 영상을 제한된 팔레트로 재구성하는 브라우저 도구",
  },
  twitter: {
    card: "summary",
    title: "Palette Forge",
    description: "원하는 색을 직접 고르고 이미지와 영상을 새롭게 구성하세요.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  other: {
    "google-adsense-account": "ca-pub-2402421786391581",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestedLanguage = (await headers()).get("x-palette-forge-language") ?? "ko";
  const language = isLanguage(requestedLanguage) ? requestedLanguage : "ko";
  return (
    <html lang={language}>
      <head>
        <meta name="theme-color" content="#17213a" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
      </head>
      <body>{children}</body>
    </html>
  );
}
