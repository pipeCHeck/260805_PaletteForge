import { ExamplesIndex } from "../ExamplePages";
import { publicPageMetadata } from "../public-metadata";

export const metadata = publicPageMetadata("examples", "ko", "/examples");

export default function ExamplesPage() {
  return <ExamplesIndex />;
}
