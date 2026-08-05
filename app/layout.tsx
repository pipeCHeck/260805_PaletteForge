import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Palette Forge — 이미지 색상 변환",
  description: "고정 색상을 정확히 보존하는 브라우저 기반 이미지 팔레트 변환기",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
