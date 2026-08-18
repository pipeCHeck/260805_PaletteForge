import InfoPage from "../InfoPage";
import { publicPageMetadata } from "../public-metadata";

export const metadata = publicPageMetadata("guide", "ko", "/guide");
export default function GuidePage() { return <InfoPage kind="guide" />; }
