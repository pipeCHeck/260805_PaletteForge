import type { Metadata } from "next";
import InfoPage from "../InfoPage";

export const metadata: Metadata = { title: "이용약관 — Palette Forge", description: "Palette Forge 이미지 변환 서비스의 이용 조건, 저작권 및 책임 범위" };
export default function TermsPage() { return <InfoPage kind="terms" />; }
