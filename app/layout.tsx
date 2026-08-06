import type { Metadata } from "next";
import "./globals.css";
import "./info.css";

export const metadata: Metadata = {
  title: "Palette Forge — 이미지 색상 변환",
  description: "고정 색상을 정확히 보존하는 브라우저 기반 이미지 팔레트 변환기",
  other: {
    "google-adsense-account": "ca-pub-2402421786391581",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2402421786391581"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
