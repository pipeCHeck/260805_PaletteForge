import type { Metadata } from "next";
import InfoPage from "../InfoPage";

export const metadata: Metadata = { title: "Palette Forge 사용 가이드", description: "이미지 불러오기부터 고정 팔레트, 색상 가중치와 내보내기까지 한눈에 보는 Palette Forge 사용 방법" };
export default function GuidePage() { return <InfoPage kind="guide" />; }
