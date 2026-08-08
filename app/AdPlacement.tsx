"use client";

import { useEffect, useRef } from "react";

const ADSENSE_CLIENT = "ca-pub-2402421786391581";
const ADVERTISING_ENABLED = false;

type AdSenseWindow = Window & { adsbygoogle?: Record<string, unknown>[] };

export default function AdPlacement({ placement, slot, label, pendingText }: { placement: "rail" | "banner"; slot: string; label: string; pendingText: string }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!ADVERTISING_ENABLED || !slot || initialized.current) return;
    try {
      const queue = window as AdSenseWindow;
      queue.adsbygoogle = queue.adsbygoogle ?? [];
      queue.adsbygoogle.push({});
      initialized.current = true;
    } catch {
      initialized.current = false;
    }
  }, [slot]);

  if (!ADVERTISING_ENABLED) return null;

  return (
    <aside className={"ad-placement ad-placement-" + placement + (slot ? " is-live" : " is-pending")} aria-label={label}>
      <span className="ad-label">{label}</span>
      {slot ? (
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format={placement === "rail" ? "rectangle" : "horizontal"}
          data-full-width-responsive="true"
        />
      ) : (
        <div className="ad-pending" aria-hidden="true">
          <strong>AD</strong>
          <small>{pendingText}</small>
        </div>
      )}
    </aside>
  );
}
