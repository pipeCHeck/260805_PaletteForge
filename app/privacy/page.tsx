import InfoPage from "../InfoPage";
import { publicPageMetadata } from "../public-metadata";

export const metadata = publicPageMetadata("privacy", "ko", "/privacy");
export default function PrivacyPage() { return <InfoPage kind="privacy" />; }
