import type { Metadata } from "next";
import PaletteStudio from "../PaletteStudio";

export const metadata: Metadata = {
  title: "팔레트 편집기",
  description: "이미지와 영상을 제한된 팔레트, 고정 색상, 픽셀 스타일로 변환하는 Palette Forge 편집기",
  alternates: { canonical: "/editor" },
  robots: { index: false, follow: true },
};

export default function EditorPage() {
  return <PaletteStudio />;
}
