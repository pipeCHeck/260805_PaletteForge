import type { Metadata } from "next";
import InfoPage from "../InfoPage";

export const metadata: Metadata = { title: "Palette Forge 사용 가이드", description: "이미지·영상 불러오기부터 색 보정, 픽셀화, 고정 팔레트, 프레임별 영상 변환과 내보내기까지 안내합니다." };
export default function GuidePage() { return <InfoPage kind="guide" />; }
