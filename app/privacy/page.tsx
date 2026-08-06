import type { Metadata } from "next";
import InfoPage from "../InfoPage";

export const metadata: Metadata = { title: "개인정보처리방침 — Palette Forge", description: "Palette Forge의 로컬 이미지 처리, 브라우저 저장소, 호스팅 및 광고 데이터 처리 안내" };
export default function PrivacyPage() { return <InfoPage kind="privacy" />; }
