import InfoPage from "../InfoPage";
import { publicPageMetadata } from "../public-metadata";

export const metadata = publicPageMetadata("terms", "ko", "/terms");
export default function TermsPage() { return <InfoPage kind="terms" />; }
