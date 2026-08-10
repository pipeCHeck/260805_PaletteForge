"use client";

import { ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SectionHelpProps = {
  label: string;
  title: string;
  summary: string;
  children?: ReactNode;
};

type Position = { left: number; top: number };

export default function SectionHelp({ label, title, summary, children }: SectionHelpProps) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ left: 12, top: 12 });

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const buttonRect = button.getBoundingClientRect();
    const popoverRect = popoverRef.current?.getBoundingClientRect();
    const width = popoverRect?.width ?? 292;
    const height = popoverRect?.height ?? 180;
    const margin = 12;
    const left = Math.min(Math.max(margin, buttonRect.left), window.innerWidth - width - margin);
    const below = buttonRect.bottom + 8;
    const top = below + height <= window.innerHeight - margin
      ? below
      : Math.max(margin, buttonRect.top - height - 8);
    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePosition]);

  return <>
    <button
      ref={buttonRef}
      type="button"
      className="section-help-button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={id}
      onClick={() => setOpen((value) => !value)}
    >?</button>
    {open && createPortal(
      <div
        ref={popoverRef}
        id={id}
        className="section-help-popover"
        role="dialog"
        aria-label={title}
        style={{ left: position.left, top: position.top }}
      >
        <div className="section-help-head">
          <strong>{title}</strong>
          <button type="button" aria-label={label} onClick={() => { setOpen(false); buttonRef.current?.focus(); }}>×</button>
        </div>
        <p>{summary}</p>
        {children}
      </div>,
      document.body,
    )}
  </>;
}
