import type { Metadata } from "next";
import "./globals.css";
import "./info.css";

export const metadata: Metadata = {
  title: "Palette Forge — 이미지·영상 팔레트 변환",
  description: "이미지와 영상을 색상 제한, 고정 팔레트, 색 보정과 픽셀화로 변환하는 브라우저 기반 로컬 도구",
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
