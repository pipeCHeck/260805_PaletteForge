import type { Metadata } from "next";
import "./globals.css";
import "./info.css";

export const metadata: Metadata = {
  title: "Palette Forge — 이미지·영상 팔레트 변환",
  description: "이미지와 영상을 색상 제한, 고정 팔레트, 색 보정과 픽셀화로 변환하는 브라우저 기반 로컬 도구",
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
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
