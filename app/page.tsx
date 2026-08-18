import LandingPage from "./LandingPage";
import { publicPageMetadata } from "./public-metadata";

export const metadata = publicPageMetadata("home", "ko", "/");

export default function Home() {
  return (
    <>
      <script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2402421786391581"
        crossOrigin="anonymous"
      />
      <LandingPage />
    </>
  );
}

