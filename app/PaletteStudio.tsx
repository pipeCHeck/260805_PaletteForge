"use client";

import { ChangeEvent, lazy, MouseEvent, PointerEvent as ReactPointerEvent, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "./version";
import {
  MAX_COLORS,
  applyPalettePreset,
  cloneSettings,
  cyclePaletteSlotMode,
  defaultSettings,
  deserializeSettingsDocument,
  fixPaletteSlot,
  fixPaletteSlotWeight,
  getExportDimensions,
  hexToRgb,
  hsvToRgb,
  normalizeSlotCount,
  parsePaletteWeight,
  paletteSlotMode,
  removePaletteSlot,
  rgbToHex,
  rgbToHsv,
  resetPaletteSettings,
  serializeSettings,
} from "../lib/palette.mjs";
import QuantizeWorker from "./quantize.worker?worker";
import { LANGUAGE_OPTIONS, Language, detectLanguage, localizeError, translate } from "./i18n";
import AdPlacement from "./AdPlacement";
import SectionHelp from "./SectionHelp";

const VideoConverter = lazy(() => import("./VideoConverter"));

type RGB = [number, number, number];
type Slot = { fixed: boolean; color: RGB | null; weight: number; weightMode: "auto" | "manual" };
type Settings = ReturnType<typeof defaultSettings>;
const DEFAULT_SLOT_COLOR: RGB = [218, 218, 213];

const AD_SLOTS = {
  rail: "",
  railSecondary: "",
  banner: "",
} as const;

const EXAMPLE_ASSETS = [
  { id: "example-01", name: "별빛을 품은 마녀" },
  { id: "example-02", name: "햇살 머문 창가" },
  { id: "example-03", name: "도심의 기념비" },
  { id: "example-04", name: "은빛 검의 기사" },
  { id: "example-05", name: "황금빛 카르보나라" },
  { id: "example-06", name: "산호빛 기하학" },
  { id: "example-07", name: "상자 요새 부대" },
  { id: "example-08", name: "큐브 레인저" },
] as const;

type PalettePreset = { id: string; name: string; colors: string[] };

const PALETTE_PRESETS: PalettePreset[] = [
  { id: "gameboy", name: "게임보이", colors: ["#252525", "#0F380F", "#306230", "#8BAC0F", "#9BBC0F"] },
  { id: "grayscale", name: "회색조", colors: ["#111317", "#4B4E4A", "#858983", "#C5C8C0", "#F4F4EF"] },
  { id: "earth", name: "따뜻한 대지", colors: ["#2A1A16", "#4A2A22", "#6B3E2E", "#A8643A", "#C47A46", "#D89B5B", "#E8C78D", "#F4E8CE"] },
  { id: "ocean", name: "바다", colors: ["#071D2B", "#0B3C5D", "#0E5E78", "#167D9A", "#45B8AC", "#70CFBE", "#A8E6CF", "#EAF9F3"] },
  { id: "sunset", name: "노을", colors: ["#2D1B46", "#6A275B", "#8E2F58", "#B23A48", "#F06449", "#F47A4B", "#F7A35C", "#FFD7A0"] },
  { id: "prism-pop", name: "프리즘 팝", colors: ["#FFFFFF", "#1E0B20", "#FDE302", "#F89B3F", "#F87D7F", "#EE1436", "#EB1569", "#9C0A64", "#3D195A", "#2D528B", "#23A1C9", "#55DDE9"] },
  { id: "cosmic-candy", name: "코스믹 캔디", colors: ["#FFFFFF", "#03053C", "#160252", "#300467", "#2F33A3", "#60A9CE", "#05C9FC", "#BAEE68", "#FEE039", "#F9A77A", "#F46795", "#CF3B96", "#7D0E93"] },
  { id: "amber-ink", name: "호박빛 먹선", colors: ["#FFFFFF", "#E3E1DE", "#F9D0BB", "#E5A88A", "#E5885E", "#D58A4E", "#F8CA6C", "#B27C6A", "#8A6C52", "#516373", "#575757", "#2C2A2A"] },
  { id: "cyber", name: "사이버 네온", colors: ["#090A1A", "#2B125C", "#3D2BFF", "#7A04EB", "#FF2BD6", "#00E5FF", "#B7FF00", "#EDD903"] },
  { id: "arcade", name: "레트로 아케이드", colors: ["#1A1C2C", "#5D275D", "#B13E53", "#EF7D57", "#FFCD75", "#A7F070", "#38B764", "#257179"] },
];
type ImageItem = {
  id: string;
  name: string;
  width: number;
  height: number;
  original: Uint8ClampedArray;
  result: Uint8ClampedArray | null;
  palette: RGB[];
  settings: Settings;
  thumbnail: string;
  hasAlpha: boolean;
  isExample?: boolean;
  exampleTitle?: string;
};

function getImageDisplayName(item: ImageItem, language: Language) {
  if (!item.isExample || !item.exampleTitle) return item.name;
  return translate(language, "예시 · {name}", { name: translate(language, item.exampleTitle) });
}

function getPaletteSlotColor(item: ImageItem, index: number): RGB {
  return item.settings.slots[index]?.color ?? item.palette[index] ?? DEFAULT_SLOT_COLOR;
}

const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function CanvasPreview({ item, result, onPick, language }: { item: ImageItem; result: boolean; onPick: (rgb: RGB | null) => void; language: Language }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const displayedPixels = useRef<Uint8ClampedArray | null>(null);
  const adjustedPreview = useRef<{ settings: Settings; pixels: Uint8ClampedArray } | null>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const moved = useRef(false);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [isViewReady, setIsViewReady] = useState(false);
  const [isFitView, setIsFitView] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showAdjusted, setShowAdjusted] = useState(() => result || !item.isExample);
  const [previewModeLocked, setPreviewModeLocked] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<{ settings: Settings; state: "ready" | "error" } | null>(null);
  const adjustmentPreviewSignature = JSON.stringify({ adjustments: item.settings.adjustments, pixelation: item.settings.pixelation });
  const previousAdjustmentPreviewSignature = useRef(adjustmentPreviewSignature);
  const tr = (source: string, values: Record<string, string | number> = {}) => translate(language, source, values);
  const isPreparing = !result && showAdjusted && previewStatus?.settings !== item.settings;
  const previewFailed = !result && showAdjusted && previewStatus?.settings === item.settings && previewStatus.state === "error";
  useEffect(() => {
    if (result || previousAdjustmentPreviewSignature.current === adjustmentPreviewSignature) return;
    previousAdjustmentPreviewSignature.current = adjustmentPreviewSignature;
    if (previewModeLocked) return;
    const frame = window.requestAnimationFrame(() => setShowAdjusted(true));
    return () => window.cancelAnimationFrame(frame);
  }, [adjustmentPreviewSignature, previewModeLocked, result]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = item.width;
    canvas.height = item.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const draw = (pixels: Uint8ClampedArray) => {
      displayedPixels.current = pixels;
      context.putImageData(new ImageData(new Uint8ClampedArray(pixels), item.width, item.height), 0, 0);
    };
    if (result) {
      if (item.result) draw(item.result);
      return;
    }
    if (!showAdjusted) {
      draw(item.original);
      return;
    }
    const cached = adjustedPreview.current;
    if (cached?.settings === item.settings) {
      draw(cached.pixels);
      return;
    }

    displayedPixels.current = null;
    const worker = new QuantizeWorker();
    const copy = new Uint8ClampedArray(item.original);
    let disposed = false;
    let finishTimer: number | null = null;
    const startedAt = performance.now();
    const finish = (state: "ready" | "error", pixels?: Uint8ClampedArray) => {
      const delay = Math.max(0, 220 - (performance.now() - startedAt));
      finishTimer = window.setTimeout(() => {
        if (disposed) return;
        if (state === "ready" && pixels) {
          adjustedPreview.current = { settings: item.settings, pixels };
          draw(pixels);
        }
        setPreviewStatus({ settings: item.settings, state });
      }, delay);
    };
    worker.onmessage = (event) => {
      worker.terminate();
      if (disposed) return;
      if (event.data.error) { finish("error"); return; }
      finish("ready", new Uint8ClampedArray(event.data.result));
    };
    worker.onerror = () => { worker.terminate(); if (!disposed) finish("error"); };
    worker.postMessage({ operation: "prepare", pixels: copy.buffer, width: item.width, height: item.height, settings: item.settings }, [copy.buffer]);
    return () => { disposed = true; worker.terminate(); if (finishTimer !== null) window.clearTimeout(finishTimer); };
  }, [item.height, item.original, item.result, item.settings, item.width, result, showAdjusted]);

  const click = (event: MouseEvent<HTMLCanvasElement>) => {
    if (moved.current) { moved.current = false; return; }
    const canvas = ref.current;
    const sampled = displayedPixels.current;
    if (!canvas || !sampled) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) return;
    const x = Math.min(item.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) * item.width / rect.width)));
    const y = Math.min(item.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) * item.height / rect.height)));
    const index = (y * item.width + x) * 4;
    onPick(sampled[index + 3] === 0 ? null : [sampled[index], sampled[index + 1], sampled[index + 2]]);
  };

  const calculateFitZoom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return 1;
    return Math.min(8, Math.max(0.05, Math.min(viewport.clientWidth / item.width, viewport.clientHeight / item.height)));
  }, [item.height, item.width]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const zoomWithWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsFitView(false);
      setView((current) => {
        const zoom = Math.min(8, Math.max(0.05, current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
        const fitZoom = calculateFitZoom();
        return zoom <= fitZoom ? { zoom, x: 0, y: 0 } : { ...current, zoom };
      });
    };
    viewport.addEventListener("wheel", zoomWithWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", zoomWithWheel);
  }, [calculateFitZoom]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !isFitView) return;
    const fitToViewport = () => setView({ zoom: calculateFitZoom(), x: 0, y: 0 });
    fitToViewport();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fitToViewport);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [calculateFitZoom, isFitView]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsViewReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const canPan = viewport && (item.width * view.zoom > viewport.clientWidth + 1 || item.height * view.zoom > viewport.clientHeight + 1);
    if (event.button !== 0 || !canPan || (event.target as HTMLElement).closest("button")) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
    moved.current = false;
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (!moved.current && Math.abs(dx) + Math.abs(dy) > 3) {
      moved.current = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!moved.current) return;
    setView((current) => ({ ...current, x: active.originX + dx, y: active.originY + dy }));
  };
  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const showActualSize = () => { setIsFitView(false); setView({ zoom: 1, x: 0, y: 0 }); };
  const toggleFitView = () => {
    if (isFitView) showActualSize();
    else { setIsFitView(true); setView({ zoom: calculateFitZoom(), x: 0, y: 0 }); }
  };
  return <div ref={viewportRef} className={`pan-zoom-viewport ${isViewReady ? "" : "is-view-initializing"} ${isDragging ? "is-dragging" : ""} ${isPreparing ? "is-processing" : ""}`} aria-busy={isPreparing} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onDoubleClick={showActualSize}>
    <canvas ref={ref} onClick={click} draggable={false} style={{ width: `${item.width}px`, height: `${item.height}px`, transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.zoom})` }} aria-label={tr(result ? "변환 결과 이미지" : showAdjusted ? "색 보정이 적용된 원본 이미지" : "원본 이미지")} />
    {isPreparing && <div className="preview-processing" role="status" aria-live="polite"><i /><span><strong>{tr("미리보기 계산 중…")}</strong><small>{tr("색 보정과 픽셀화를 적용하고 있습니다.")}</small></span></div>}
    {previewFailed && <div className="preview-processing is-error" role="alert"><span><strong>{tr("미리보기를 계산하지 못했습니다.")}</strong><small>{tr("설정을 다시 변경하거나 이미지를 다시 불러와주세요.")}</small></span></div>}
    <div className="preview-control-bar">
      {!result && <div className="preview-mode-toggle" role="group" aria-label={tr("원본과 보정 미리보기 전환")}><div className="preview-mode-choice"><button type="button" aria-pressed={!showAdjusted} onClick={() => setShowAdjusted(false)}>{tr("원본")}</button><button type="button" aria-pressed={showAdjusted} onClick={() => setShowAdjusted(true)}>{tr("보정")}</button></div><span className="preview-mode-divider" aria-hidden="true" /><button type="button" className="preview-mode-lock" aria-pressed={previewModeLocked} aria-label={tr(previewModeLocked ? "미리보기 자동 전환 잠금 해제" : "미리보기 자동 전환 잠금")} title={tr(previewModeLocked ? "미리보기 자동 전환 잠금 해제" : "미리보기 자동 전환 잠금")} onClick={() => setPreviewModeLocked((locked) => !locked)}><span className="preview-lock-glyph" aria-hidden="true" /></button></div>}
      <div className="zoom-controls"><span>{Math.round(view.zoom * 100)}%</span><button type="button" onClick={toggleFitView}>{tr(isFitView ? "화면 맞춤" : "100%로 보기")}</button></div>
    </div>
  </div>;
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function containsTransparency(pixels: Uint8ClampedArray) {
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) return true;
  }
  return false;
}

function createThumbnail(source: HTMLCanvasElement, transparent: boolean) {
  const maximum = 96;
  const scale = Math.min(1, maximum / Math.max(source.width, source.height));
  const thumbnail = document.createElement("canvas");
  thumbnail.width = Math.max(1, Math.round(source.width * scale));
  thumbnail.height = Math.max(1, Math.round(source.height * scale));
  thumbnail.getContext("2d")!.drawImage(source, 0, 0, thumbnail.width, thumbnail.height);
  return thumbnail.toDataURL(transparent ? "image/png" : "image/jpeg", 0.72);
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function processInWorker(item: ImageItem, language: Language): Promise<{ result: Uint8ClampedArray; palette: RGB[]; weights: number[] }> {
  return new Promise((resolve, reject) => {
    const worker = new QuantizeWorker();
    const copy = new Uint8ClampedArray(item.original);
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.error) reject(new Error(localizeError(language, event.data.error)));
      else resolve({ result: new Uint8ClampedArray(event.data.result), palette: event.data.palette, weights: event.data.weights });
    };
    worker.onerror = () => { worker.terminate(); reject(new Error(translate(language, "이미지 변환 작업을 시작하지 못했습니다."))); };
    worker.postMessage({ pixels: copy.buffer, width: item.width, height: item.height, settings: item.settings }, [copy.buffer]);
  });
}

async function exportBlob(item: ImageItem, language: Language) {
  if (!item.result) throw new Error(translate(language, "먼저 이미지를 변환해주세요."));
  const dimensions = getExportDimensions(item.width, item.height, item.settings);
  const staging = document.createElement("canvas");
  staging.width = dimensions.width; staging.height = dimensions.height;
  if (dimensions.width === item.width && dimensions.height === item.height) {
    staging.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(item.result), item.width, item.height), 0, 0);
  } else {
    const reduced = new Uint8ClampedArray(dimensions.width * dimensions.height * 4);
    const blockSize = item.settings.pixelation.size;
    for (let y = 0; y < dimensions.height; y += 1) {
      for (let x = 0; x < dimensions.width; x += 1) {
        const sourceIndex = (Math.min(item.height - 1, y * blockSize) * item.width + Math.min(item.width - 1, x * blockSize)) * 4;
        reduced.set(item.result.subarray(sourceIndex, sourceIndex + 4), (y * dimensions.width + x) * 4);
      }
    }
    staging.getContext("2d")!.putImageData(new ImageData(reduced, dimensions.width, dimensions.height), 0, 0);
  }
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width; canvas.height = dimensions.height;
  const context = canvas.getContext("2d")!;
  const flatten = item.settings.export.format === "jpeg" || !item.settings.export.preserveAlpha;
  if (flatten) {
    context.fillStyle = item.settings.export.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(staging, 0, 0, canvas.width, canvas.height);
  const mime = `image/${item.settings.export.format}`;
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(translate(language, "이 브라우저에서 선택한 형식으로 내보낼 수 없습니다."))), mime, item.settings.export.quality));
}

export default function PaletteStudio() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("이미지를 불러오면 모든 처리가 이 브라우저 안에서 진행됩니다.");
  const [messageType, setMessageType] = useState<"info" | "error" | "success">("info");
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [samplingSlot, setSamplingSlot] = useState<number | null>(null);
  const [draftHex, setDraftHex] = useState("#DADAD5");
  const [draftRgb, setDraftRgb] = useState<[string, string, string]>(["218", "218", "213"]);
  const [draftHue, setDraftHue] = useState(0);
  const [colorError, setColorError] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [saveSections, setSaveSections] = useState({ adjust: true, palette: true });
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});
  const [adjustmentDrafts, setAdjustmentDrafts] = useState<Record<string, string>>({});
  const [pixelSizeDrafts, setPixelSizeDrafts] = useState<Record<string, string>>({});
  const [paletteTendencyDrafts, setPaletteTendencyDrafts] = useState<Record<string, string>>({});
  const [surfaceCleanupDrafts, setSurfaceCleanupDrafts] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<Language>("ko");
  const [languageReady, setLanguageReady] = useState(false);
  const [exampleLoading, setExampleLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const settingsInput = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const exampleStarted = useRef(false);
  const current = images.find((image) => image.id === selectedId) ?? null;
  const sampling = samplingSlot !== null;
  const tr = (source: string, values: Record<string, string | number> = {}) => translate(language, source, values);

  useEffect(() => {
    let savedTheme: string | null = null;
    try { savedTheme = window.localStorage.getItem("palette-forge-theme"); } catch { /* 저장소가 막힌 환경에서는 시스템 설정을 사용합니다. */ }
    const nextTheme = savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    const timer = window.setTimeout(() => setTheme(nextTheme), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try { window.localStorage.setItem("palette-forge-theme", nextTheme); } catch { /* 테마 전환 자체는 계속 동작합니다. */ }
  };

  useEffect(() => {
    let savedLanguage: string | null = null;
    try { savedLanguage = window.localStorage.getItem("palette-forge-language"); } catch { /* 저장소가 막힌 환경에서는 브라우저 언어를 사용합니다. */ }
    const nextLanguage = savedLanguage === "ko" || savedLanguage === "ja" || savedLanguage === "en" ? savedLanguage : detectLanguage(window.navigator.language);
    document.documentElement.lang = nextLanguage;
    const timer = window.setTimeout(() => {
      setLanguage(nextLanguage);
      setLanguageReady(true);
      setMessage(translate(nextLanguage, "이미지를 불러오면 모든 처리가 이 브라우저 안에서 진행됩니다."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const notice = noticeRef.current;
    const workspace = workspaceRef.current;
    if (!notice || !workspace) return;
    let frame = 0;
    const syncRelease = () => {
      frame = 0;
      if (window.innerWidth < 1181 || window.innerWidth > 1599) {
        notice.style.removeProperty("--notice-release-offset");
        return;
      }
      const panelReleaseLine = window.innerHeight - 12;
      const offset = Math.min(0, workspace.getBoundingClientRect().bottom - panelReleaseLine);
      notice.style.setProperty("--notice-release-offset", `${offset}px`);
    };
    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncRelease);
    };
    syncRelease();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleSync);
    observer?.observe(workspace);
    return () => {
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  const changeLanguage = (nextLanguage: Language) => {
    document.documentElement.lang = nextLanguage;
    setLanguage(nextLanguage);
    setMessage(translate(nextLanguage, "이미지를 불러오면 모든 처리가 이 브라우저 안에서 진행됩니다."));
    setMessageType("info");
    try { window.localStorage.setItem("palette-forge-language", nextLanguage); } catch { /* 언어 전환 자체는 계속 동작합니다. */ }
  };

  const notify = useCallback((text: string, type: "info" | "error" | "success" = "info") => { setMessage(text); setMessageType(type); }, []);
  const replace = (id: string, updater: (item: ImageItem) => ImageItem) => setImages((items) => items.map((item) => item.id === id ? updater(item) : item));
  const updateCurrent = (updater: (item: ImageItem) => ImageItem) => { if (current) replace(current.id, updater); };
  const updateSettings = (updater: (settings: Settings) => Settings, invalidateResult = true) => updateCurrent((item) => {
    const settings = normalizeSlotCount(updater(cloneSettings(item.settings)));
    return { ...item, settings, result: invalidateResult ? null : item.result };
  });

  const loadImageFiles = useCallback(async (files: File[], fromClipboard = false) => {
    if (!files.length) return;
    if (busy) { notify(translate(language, "이미지를 처리하는 동안에는 새 이미지를 추가할 수 없습니다."), "error"); return; }
    setBusy(true);
    const loaded: ImageItem[] = [];
    const errors: string[] = [];
    const clipboardStamp = Date.now();
    for (const [index, file] of files.entries()) {
      const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
      const displayName = fromClipboard ? `clipboard-${clipboardStamp}${index ? `-${index + 1}` : ""}.${extension}` : file.name;
      if (!SUPPORTED_TYPES.has(file.type)) { errors.push(translate(language, "{name}: PNG, JPEG, WebP만 지원합니다.", { name: displayName })); continue; }
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        context.drawImage(bitmap, 0, 0); bitmap.close();
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const settings = defaultSettings();
        settings.export.fileName = `${baseName(displayName)}-converted`;
        const hasAlpha = containsTransparency(imageData.data);
        loaded.push({
          id: crypto.randomUUID(), name: displayName, width: canvas.width, height: canvas.height,
          original: imageData.data, result: null, palette: [], settings,
          thumbnail: createThumbnail(canvas, hasAlpha),
          hasAlpha,
        });
      } catch { errors.push(translate(language, "{name}: 파일이 손상되었거나 디코딩할 수 없습니다.", { name: displayName })); }
    }
    if (loaded.length) {
      setImages((items) => [...items, ...loaded]);
      setSelectedId(loaded[0].id);
    }
    setBusy(false);
    if (errors.length) notify(errors.join(" "), "error");
    else notify(translate(language, fromClipboard ? "클립보드에서 {count}개 이미지를 불러왔습니다." : "{count}개 이미지를 원본 순서대로 불러왔습니다.", { count: loaded.length }), "success");
  }, [busy, language, notify]);

  const loadImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void loadImageFiles(files);
  };

  useEffect(() => {
    const pasteImages = (event: ClipboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
      if (!files.length) return;
      event.preventDefault();
      void loadImageFiles(files, true);
    };
    window.addEventListener("paste", pasteImages);
    return () => window.removeEventListener("paste", pasteImages);
  }, [loadImageFiles]);

  const changeCount = (value: string) => {
    if (!current) return;
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > MAX_COLORS) { notify(tr("최종 색상 수는 1~{max}의 정수여야 합니다.", { max: MAX_COLORS }), "error"); return; }
    const removedFixed = current.settings.slots.slice(count).some((slot: Slot) => slot.fixed);
    if (removedFixed && !window.confirm(tr("범위를 벗어나는 고정 색상이 있습니다. 해당 슬롯을 삭제할까요?"))) return;
    updateSettings((settings) => {
      settings.colorCount = count;
      settings.slots = settings.slots.slice(0, count);
      while (settings.slots.length < count) settings.slots.push({ fixed: false, color: null, weight: 1, weightMode: "auto" });
      return settings;
    });
    notify(tr("팔레트 슬롯을 {count}개로 변경했습니다.", { count }));
  };

  const openColor = (index: number) => {
    if (!current) return;
    const color = getPaletteSlotColor(current, index);
    setActiveSlot(index); setDraftHex(rgbToHex(color)); setDraftRgb(color.map(String) as [string, string, string]); setDraftHue(rgbToHsv(color)[0]); setColorError("");
  };

  const applyColor = (rgb: RGB, slotIndex: number | null = activeSlot) => {
    if (slotIndex === null) return;
    updateSettings((settings) => fixPaletteSlot(settings, slotIndex, rgb));
    setDraftHex(rgbToHex(rgb)); setDraftRgb(rgb.map(String) as [string, string, string]); setDraftHue(rgbToHsv(rgb)[0]); setColorError(""); setSamplingSlot(null);
  };

  const applyDraft = () => {
    const fromHex = hexToRgb(draftHex);
    const values = draftRgb.map(Number);
    const rgbValid = values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255);
    if (!fromHex || !rgbValid || rgbToHex(values) !== draftHex.toUpperCase()) { setColorError(tr("HEX는 #RRGGBB, RGB는 각각 0~255로 입력하고 서로 일치시켜주세요.")); return; }
    applyColor(values as RGB); setActiveSlot(null);
  };

  const syncHex = (value: string) => {
    setDraftHex(value.toUpperCase()); const rgb = hexToRgb(value);
    if (rgb) { const hsv = rgbToHsv(rgb); setDraftRgb(rgb.map(String) as [string, string, string]); if (hsv[1] > 0) setDraftHue(hsv[0]); setColorError(""); }
  };

  const syncRgb = (index: number, value: string) => {
    const next = [...draftRgb] as [string, string, string]; next[index] = value; setDraftRgb(next);
    const values = next.map(Number);
    if (values.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) { const hsv = rgbToHsv(values); setDraftHex(rgbToHex(values)); if (hsv[1] > 0) setDraftHue(hsv[0]); setColorError(""); }
  };

  const draftColor = (hexToRgb(draftHex) ?? [0, 0, 0]) as RGB;
  const convertedDraftHsv = rgbToHsv(draftColor);
  const draftHsv = [draftHue, convertedDraftHsv[1], convertedDraftHsv[2]];
  const setDraftColor = (rgb: number[], hue = rgbToHsv(rgb)[0]) => {
    const color = rgb as RGB;
    setDraftHex(rgbToHex(color)); setDraftRgb(color.map(String) as [string, string, string]); setDraftHue(hue); setColorError("");
  };
  const updateSaturationValue = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const saturation = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const value = Math.min(100, Math.max(0, (1 - (event.clientY - bounds.top) / bounds.height) * 100));
    setDraftColor(hsvToRgb([draftHsv[0], saturation, value]));
  };

  const pick = (rgb: RGB | null) => {
    if (samplingSlot === null) return;
    if (!rgb) { notify(tr("완전 투명한 픽셀에서는 색상을 가져올 수 없습니다."), "error"); return; }
    applyColor(rgb, samplingSlot); setActiveSlot(null); notify(tr("{hex} 색상을 고정하고 팔레트에 반영했습니다.", { hex: rgbToHex(rgb) }), "success");
  };

  const screenPick = async () => {
    const EyeDropperClass = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!EyeDropperClass) { notify(tr("이 브라우저는 화면 전체 스포이드를 지원하지 않습니다. 이미지 내부 스포이드를 사용해주세요."), "error"); return; }
    const slotIndex = activeSlot;
    try { const result = await new EyeDropperClass().open(); const rgb = hexToRgb(result.sRGBHex); if (rgb) { applyColor(rgb as RGB, slotIndex); setActiveSlot(null); notify(tr("{hex} 색상을 고정하고 팔레트에 반영했습니다.", { hex: rgbToHex(rgb) }), "success"); } }
    catch { notify(tr("화면 스포이드 선택을 취소했습니다.")); }
  };

  const convertOne = useCallback(async (item: ImageItem) => {
    const converted = await processInWorker(item, language);
    const settings = cloneSettings(item.settings);
    settings.slots = settings.slots.map((slot: Slot, index: number) => ({ ...slot, color: slot.fixed ? slot.color : converted.palette[index], weight: converted.weights[index] }));
    return { ...item, result: converted.result, palette: converted.palette, settings };
  }, [language]);

  useEffect(() => {
    if (!languageReady || exampleStarted.current) return;
    exampleStarted.current = true;
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    const example = EXAMPLE_ASSETS[randomValue % EXAMPLE_ASSETS.length];
    setBusy(true);
    notify(translate(language, "예시 이미지를 불러와 자동으로 변환하고 있습니다…"));
    void (async () => {
      try {
        const [imageResponse, settingsResponse] = await Promise.all([
          fetch(`/examples/${example.id}.png`),
          fetch(`/examples/${example.id}.json`),
        ]);
        if (!imageResponse.ok || !settingsResponse.ok) throw new Error("example-fetch-failed");
        const [imageBlob, settingsText] = await Promise.all([imageResponse.blob(), settingsResponse.text()]);
        const bitmap = await createImageBitmap(imageBlob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("example-canvas-failed");
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const settings = deserializeSettingsDocument(settingsText, defaultSettings()).settings;
        settings.export.fileName = `${example.id}-converted`;
        const id = crypto.randomUUID();
        const hasAlpha = containsTransparency(imageData.data);
        const source: ImageItem = {
          id,
          name: `${example.id}.png`,
          width: canvas.width,
          height: canvas.height,
          original: imageData.data,
          result: null,
          palette: [],
          settings,
          thumbnail: createThumbnail(canvas, hasAlpha),
          hasAlpha,
          isExample: true,
          exampleTitle: example.name,
        };
        const converted = await convertOne(source);
        setImages([converted]);
        setSelectedId(id);
        notify(translate(language, "{name} 예시와 설정을 자동으로 불러와 변환했습니다. 내 이미지를 추가해도 예시는 목록에 유지됩니다.", { name: translate(language, example.name) }), "success");
      } catch {
        notify(translate(language, "예시 이미지를 불러오지 못했습니다. 직접 이미지를 추가해주세요."), "error");
      } finally {
        setExampleLoading(false);
        setBusy(false);
      }
    })();
  }, [convertOne, language, languageReady, notify]);

  const convertCurrent = async () => {
    if (!current || busy) return;
    setBusy(true); notify(tr("원본 해상도로 변환하고 있습니다…"));
    try { const updated = await convertOne(current); replace(current.id, () => updated); notify(tr("변환이 완료되었습니다."), "success"); }
    catch (error) { notify(error instanceof Error ? localizeError(language, error.message) : tr("이미지 변환에 실패했습니다."), "error"); }
    finally { setBusy(false); }
  };

  const saveSettings = () => {
    if (!current) return;
    const includedSections = (["adjust", "palette"] as const).filter((section) => saveSections[section]);
    try {
      download(new Blob([serializeSettings(current.settings, includedSections)], { type: "application/json" }), `${baseName(current.name)}-palette-settings.json`);
      setSaveDialogOpen(false);
      notify(tr("{sections} 설정 파일을 저장했습니다.", { sections: includedSections.map((section) => section.toUpperCase()).join(", ") }), "success");
    }
    catch (error) { notify(error instanceof Error ? localizeError(language, error.message) : tr("설정 저장에 실패했습니다."), "error"); }
  };

  const loadSettings = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !current) return;
    const target = current;
    try {
      const loaded = deserializeSettingsDocument(await file.text(), target.settings);
      replace(target.id, (item) => ({ ...item, settings: loaded.settings, result: null, palette: [] }));
      notify(tr("{sections} 설정을 현재 이미지에 적용했습니다.", { sections: loaded.includedSections.map((section) => section.toUpperCase()).join(", ") }), "success");
    }
    catch (error) { notify(error instanceof Error ? localizeError(language, error.message) : tr("설정 파일을 불러오지 못했습니다."), "error"); }
  };

  const exportCurrent = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const item = current.result ? current : await convertOne(current);
      if (!current.result) replace(current.id, () => item);
      const blob = await exportBlob(item, language);
      download(blob, `${item.settings.export.fileName}.${item.settings.export.format === "jpeg" ? "jpg" : item.settings.export.format}`);
      notify(tr("현재 이미지를 내보냈습니다."), "success");
    } catch (error) { notify(error instanceof Error ? localizeError(language, error.message) : tr("이미지 내보내기에 실패했습니다."), "error"); }
    finally { setBusy(false); }
  };

  const exportAll = async () => {
    if (!images.length || busy) return;
    setBusy(true); const used = new Map<string, number>(); const failures: string[] = []; const updated: ImageItem[] = [];
    for (const source of images) {
      try {
        const item = source.result ? source : await convertOne(source); updated.push(item);
        const extension = item.settings.export.format === "jpeg" ? "jpg" : item.settings.export.format;
        const key = `${item.settings.export.fileName}.${extension}`; const count = used.get(key) ?? 0; used.set(key, count + 1);
        const name = count ? `${item.settings.export.fileName}-${count + 1}.${extension}` : key;
        download(await exportBlob(item, language), name);
      } catch { failures.push(source.name); updated.push(source); }
    }
    setImages(updated); setBusy(false);
    if (failures.length) notify(tr("일부 이미지 내보내기에 실패했습니다: {names}", { names: failures.join(", ") }), "error");
    else notify(tr("{count}개 이미지를 각각 내보냈습니다.", { count: images.length }), "success");
  };

  const fixedCount = current?.settings.slots.filter((slot: Slot) => slot.fixed).length ?? 0;
  const resetPaletteSlots = () => {
    if (!current) return;
    const draftPrefix = `${current.id}:`;
    setWeightDrafts((values) => Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith(draftPrefix))));
    updateCurrent((item) => ({ ...item, settings: resetPaletteSettings(item.settings), result: null, palette: [] }));
    notify(tr("모든 고정 색상과 가중치를 초기화했습니다."), "success");
  };
  const selectPalettePreset = (preset: PalettePreset) => {
    if (!current) return;
    const colors = preset.colors.map((hex) => hexToRgb(hex) as RGB);
    const draftPrefix = `${current.id}:`;
    setWeightDrafts((values) => Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith(draftPrefix))));
    updateCurrent((item) => ({ ...item, settings: applyPalettePreset(item.settings, colors), result: null, palette: colors.map((color) => [...color] as RGB) }));
    setActiveSlot(null);
    setSamplingSlot(null);
    setPresetDialogOpen(false);
    notify(tr("{name} 프리셋을 적용했습니다. 변환 실행을 누르면 결과에 반영됩니다.", { name: tr(preset.name) }), "success");
  };
  const deletePaletteSlot = (index: number) => {
    if (!current) return;
    if (current.settings.colorCount <= 1) {
      notify(tr("팔레트에는 최소 한 가지 색상이 필요합니다."), "error");
      return;
    }
    const draftPrefix = `${current.id}:`;
    setWeightDrafts((values) => Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith(draftPrefix))));
    updateCurrent((item) => ({
      ...item,
      settings: removePaletteSlot(item.settings, index),
      result: null,
      palette: item.palette.filter((_, paletteIndex) => paletteIndex !== index).slice(0, item.settings.colorCount - 1),
    }));
    setActiveSlot(null);
    setSamplingSlot(null);
    notify(tr("팔레트에서 {index}번 색상을 삭제했습니다.", { index: index + 1 }), "success");
  };
  const weightKey = (imageId: string, index: number) => `${imageId}:${index}`;
  const commitWeight = (index: number) => {
    if (!current) return;
    const key = weightKey(current.id, index);
    const draft = weightDrafts[key] ?? String(current.settings.slots[index].weight);
    const weight = parsePaletteWeight(draft);
    setWeightDrafts((values) => { const next = { ...values }; delete next[key]; return next; });
    if (weight === null) { notify(tr("가중치는 0.1~5 사이의 숫자여야 합니다. 기존 값으로 되돌렸습니다."), "error"); return; }
    const color = getPaletteSlotColor(current, index);
    updateSettings((settings) => fixPaletteSlotWeight(settings, index, color, weight));
  };
  const commitPaletteTendency = () => {
    if (!current) return;
    const draft = paletteTendencyDrafts[current.id] ?? String(current.settings.paletteDiversity - 50);
    const tendency = Number(draft);
    setPaletteTendencyDrafts((values) => { const next = { ...values }; delete next[current.id]; return next; });
    if (!Number.isInteger(tendency) || tendency < -50 || tendency > 50) {
      notify(tr("자동 팔레트 성향은 -50~50 사이의 정수여야 합니다. 기존 값으로 되돌렸습니다."), "error");
      return;
    }
    if (tendency !== current.settings.paletteDiversity - 50) updateSettings((settings) => { settings.paletteDiversity = tendency + 50; return settings; });
  };
  const commitSurfaceCleanup = () => {
    if (!current) return;
    const draft = surfaceCleanupDrafts[current.id] ?? String(current.settings.surfaceCleanup ?? 50);
    const strength = Number(draft);
    setSurfaceCleanupDrafts((values) => { const next = { ...values }; delete next[current.id]; return next; });
    if (!Number.isInteger(strength) || strength < 0 || strength > 100) {
      notify(tr("면 정리 강도는 0~100 사이의 정수여야 합니다. 기존 값으로 되돌렸습니다."), "error");
      return;
    }
    if (strength !== (current.settings.surfaceCleanup ?? 50)) updateSettings((settings) => { settings.surfaceCleanup = strength; return settings; });
  };
  const commitPixelSize = () => {
    if (!current) return;
    const draft = pixelSizeDrafts[current.id] ?? String(current.settings.pixelation.size);
    const size = Number(draft);
    setPixelSizeDrafts((values) => { const next = { ...values }; delete next[current.id]; return next; });
    if (!Number.isInteger(size) || size < 2 || size > 64) {
      notify(tr("픽셀화 블록 크기는 2~64 사이의 정수여야 합니다. 기존 값으로 되돌렸습니다."), "error");
      return;
    }
    if (size !== current.settings.pixelation.size) updateSettings((settings) => { settings.pixelation.size = size; return settings; });
  };
  const adjustmentFields = useMemo(() => [
    ["brightness", "밝기", -100, 100], ["contrast", "대비", -100, 100],
    ["saturation", "채도", -100, 100], ["hue", "색조", -180, 180],
  ] as const, []);
  const adjustmentKey = (imageId: string, key: keyof Settings["adjustments"]) => `${imageId}:${key}`;
  const commitAdjustment = (key: keyof Settings["adjustments"], label: string, min: number, max: number) => {
    if (!current) return;
    const draftKey = adjustmentKey(current.id, key);
    const value = Number(adjustmentDrafts[draftKey] ?? String(current.settings.adjustments[key]));
    setAdjustmentDrafts((drafts) => { const next = { ...drafts }; delete next[draftKey]; return next; });
    if (!Number.isInteger(value) || value < min || value > max) {
      notify(tr("{name} 값은 {min}~{max} 사이의 정수여야 합니다. 기존 값으로 되돌렸습니다.", { name: tr(label), min, max }), "error");
      return;
    }
    if (value !== current.settings.adjustments[key]) updateSettings((settings) => { settings.adjustments[key] = value; return settings; });
  };

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">PF</span><div><h1>Palette Forge <span className="brand-version" title={`Version ${APP_VERSION}`}>v{APP_VERSION}</span></h1><p>{tr("이미지와 영상을 팔레트·픽셀 스타일로 변환하는 브라우저 도구")}</p></div></div>
        <div className="header-actions">
          <button className="button video-open-button" onClick={() => setVideoDialogOpen(true)} disabled={busy} aria-label={tr("영상 변환")}>
            <span className="video-open-icon" aria-hidden="true">▶</span>
            <span className="video-open-copy"><small>VIDEO</small><strong>{tr("영상 변환")}</strong></span>
          </button>
          <span className="header-action-divider" aria-hidden="true" />
          <button className="button theme-toggle" type="button" onClick={toggleTheme} aria-pressed={theme === "dark"} aria-label={tr("{mode} 모드로 전환", { mode: tr(theme === "dark" ? "라이트" : "다크") })} title={tr("{mode} 모드로 전환", { mode: tr(theme === "dark" ? "라이트" : "다크") })}><span className="theme-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span className="theme-label">{tr(theme === "dark" ? "라이트" : "다크")}</span></button>
          <label className="language-control"><span aria-hidden="true">文</span><select value={language} aria-label={tr("언어 선택")} onChange={(event) => changeLanguage(event.target.value as Language)}>{LANGUAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          <button className="button ghost" onClick={() => fileInput.current?.click()} disabled={busy}>{tr("이미지 추가")}</button>
          <button className="button primary" onClick={convertCurrent} disabled={!current || busy}>{tr(busy ? "처리 중…" : "변환 실행")}</button>
        </div>
        <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={loadImages} />
      </header>

      <div ref={noticeRef} className={`notice ${messageType}`} role="status"><span>{messageType === "error" ? "!" : messageType === "success" ? "✓" : "i"}</span>{message}</div>

      <div ref={workspaceRef} className="workspace">
        <aside className="image-rail panel">
          <div className="panel-title"><div><span className="eyebrow">SOURCE</span><h2>{tr("이미지 목록")} <b>{images.length}</b></h2></div><button className="icon-button" aria-label={tr("이미지 추가")} onClick={() => fileInput.current?.click()}>＋</button></div>
          <button className="dropzone" onClick={() => fileInput.current?.click()} disabled={busy}><span>＋</span><strong>{tr("이미지 불러오기")}</strong><small>{tr("PNG · JPEG · WebP / 여러 장 선택 가능")}</small><small className="paste-hint">{tr("또는 Ctrl+V로 클립보드 이미지 붙여넣기")}</small></button>
          <div className="image-list">
            {images.map((image, index) => <button key={image.id} className={`image-item ${selectedId === image.id ? "selected" : ""}`} onClick={() => { setSelectedId(image.id); setActiveSlot(null); setSamplingSlot(null); }}>
              {/* Object URL이 아닌 메모리 내 썸네일이므로 Next Image 최적화 대상이 아닙니다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumbnail} alt="" /><span className="image-copy"><strong>{getImageDisplayName(image, language)}</strong><small>{image.width} × {image.height}px · #{index + 1}</small></span><i className={image.result ? "done" : "pending"}>{tr(image.result ? "완료" : "대기")}</i>
            </button>)}
            {!images.length && <p className="empty-list">{tr("불러온 이미지가 없습니다.")}</p>}
          </div>
          <AdPlacement placement="rail" slot={AD_SLOTS.rail} label="Advertisements" pendingText={tr("\uC2B9\uC778 \uD6C4 \uAD11\uACE0\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.")} />
          <div className="rail-ad-secondary">
            <AdPlacement placement="rail" slot={AD_SLOTS.railSecondary} label="Advertisements" pendingText={tr("\uC2B9\uC778 \uD6C4 \uAD11\uACE0\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.")} />
          </div>
          {!!images.length && <div className="rail-actions"><button className="text-button danger" onClick={() => { if (!current) return; setImages((items) => items.filter((item) => item.id !== current.id)); const next = images.find((item) => item.id !== current.id); setSelectedId(next?.id ?? null); }}>{tr("선택 삭제")}</button><button className="text-button" onClick={() => { if (window.confirm(tr("모든 이미지를 목록에서 삭제할까요?"))) { setImages([]); setSelectedId(null); } }}>{tr("전체 삭제")}</button></div>}
        </aside>

        <section className="preview-panel panel">
          <div className="panel-title"><div><div className="section-kicker"><span className="eyebrow">PREVIEW</span><SectionHelp label={tr("미리보기 도움말 열기")} title={tr("미리보기")} summary={tr("먼저 위쪽에서 원본과 보정 상태를 확인한 뒤, 아래쪽에서 변환 결과를 비교하세요.")}><ul><li><strong>{tr("확대·이동")}</strong>{tr("마우스 휠로 확대하고 드래그해 이동할 수 있습니다.")}</li><li><strong>{tr("색 가져오기")}</strong>{tr("이미지를 클릭하면 해당 픽셀의 색상을 팔레트에 가져올 수 있습니다.")}</li><li><strong>{tr("표시 전환")}</strong>{tr("원본·보정 전환과 잠금, 화면 맞춤을 우하단에서 조절합니다.")}</li></ul></SectionHelp></div><h2>{current ? getImageDisplayName(current, language) : tr(exampleLoading ? "예시 이미지 준비 중" : "미리보기")}</h2></div>{current && <span className="dimension">{current.width} × {current.height}px</span>}</div>
          {current ? <div className={`compare ${sampling ? "sampling" : ""}`}>
            <figure><figcaption><span>{tr("원본 + 보정 미리보기")}</span><small>{tr("휠 확대 · 드래그 이동 · 클릭 색상 추출")}</small></figcaption><div className="canvas-wrap checker"><CanvasPreview key={`${current.id}-original`} item={current} result={false} onPick={pick} language={language} /></div></figure>
            <figure><figcaption><span>{tr("변환 결과")}</span><small>{current.result ? tr("{count}색 · 휠 확대 · 드래그 이동", { count: current.palette.length }) : tr("변환 전")}</small></figcaption><div className="canvas-wrap checker">{current.result ? <CanvasPreview key={`${current.id}-result`} item={current} result onPick={pick} language={language} /> : <div className="result-placeholder"><span>◇</span><p>{tr("변환 실행 후 결과가 표시됩니다.")}</p></div>}</div></figure>
          </div> : exampleLoading ? <div className="example-loading" role="status" aria-live="polite">
            <div className="example-loading-preview checker" aria-hidden="true"><span>PF</span><i /></div>
            <h2>{tr("예시 이미지를 준비하고 있습니다")}</h2>
            <p>{tr("이미지와 설정을 불러온 뒤 자동으로 변환합니다.")}</p>
          </div> : <div className="empty-preview"><span className="empty-glyph">◫</span><h2>{tr("색을 다듬을 이미지를 불러오세요")}</h2><p>{tr("파일은 업로드되지 않으며 원본 해상도로 브라우저 안에서 처리됩니다.")}</p><button className="button primary" onClick={() => fileInput.current?.click()}>{tr("이미지 선택")}</button></div>}
        </section>

        <aside className="control-panel">
          <section className="panel control-section">
            <div className="panel-title compact"><div><div className="section-kicker"><span className="eyebrow">ADJUST</span><SectionHelp label={tr("색 보정 도움말 열기")} title={tr("색 보정")} summary={tr("색을 줄이기 전에 이미지의 밝기와 색감, 픽셀 모양을 바꾸는 곳입니다. 모든 변경은 원본에서 다시 계산됩니다.")}><ul><li><strong>{tr("밝기·대비")}</strong>{tr("밝기는 이미지 전체를 밝거나 어둡게 하고, 대비는 밝은 곳과 어두운 곳의 차이를 조절합니다.")}</li><li><strong>{tr("채도·색조")}</strong>{tr("채도는 색의 선명함을 조절하고, 색조는 전체 색상을 다른 계열로 이동시킵니다.")}</li><li><strong>{tr("픽셀화")}</strong>{tr("이미지를 정사각형 블록으로 묶습니다. 블록 크기가 클수록 픽셀이 더 굵어집니다.")}</li><li><strong>{tr("부드러운 알파")}</strong>{tr("반투명 정도를 그대로 유지해 가장자리와 그림자가 부드럽게 보입니다.")}</li><li><strong>{tr("0 · 1 알파")}</strong>{tr("각 블록을 완전 투명 또는 완전 불투명으로 나눠 또렷한 픽셀 가장자리를 만듭니다.")}</li></ul></SectionHelp></div><h2>{tr("색 보정")}</h2></div>{current && <button className="text-button" onClick={() => updateSettings((settings) => { settings.adjustments = defaultSettings().adjustments; return settings; })}>{tr("초기화")}</button>}</div>
            <p className="section-note">{tr("원본에서 다시 계산되며 보정값이 누적되지 않습니다.")}</p>
            <div className="sliders">{adjustmentFields.map(([key, label, min, max]) => {
              const draftKey = current ? adjustmentKey(current.id, key) : key;
              return <label key={key}><span>{tr(label)}<input className="adjustment-number compact-number-input" type="number" inputMode="numeric" min={min} max={max} step="1" aria-label={`${tr(label)} ${tr("숫자 직접 입력")}`} disabled={!current} value={current ? (adjustmentDrafts[draftKey] ?? String(current.settings.adjustments[key])) : "0"} onChange={(event) => { if (!current) return; setAdjustmentDrafts((drafts) => ({ ...drafts, [draftKey]: event.target.value })); }} onBlur={() => commitAdjustment(key, label, min, max)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span><input type="range" min={min} max={max} value={current?.settings.adjustments[key] ?? 0} disabled={!current} onChange={(event) => { if (current) setAdjustmentDrafts((drafts) => { const next = { ...drafts }; delete next[adjustmentKey(current.id, key)]; return next; }); updateSettings((settings) => { settings.adjustments[key] = Number(event.target.value); return settings; }); }} /></label>;
            })}</div>
            <div className={`pixelation-setting ${current?.settings.pixelation.enabled ? "is-enabled" : ""}`}>
              <label className="pixelation-toggle"><span><strong>{tr("픽셀화")}</strong><small>{tr("색상 제한 전에 블록 효과 적용")}</small></span><input type="checkbox" aria-label={tr("픽셀화 사용")} disabled={!current} checked={current?.settings.pixelation.enabled ?? false} onChange={(event) => updateSettings((settings) => { settings.pixelation.enabled = event.target.checked; return settings; })} /></label>
              <div className="pixelation-size"><div><span>{tr("블록 크기")}</span><input className="compact-number-input" type="number" inputMode="numeric" aria-label={tr("픽셀화 블록 크기 숫자")} min="2" max="64" step="1" disabled={!current || !current.settings.pixelation.enabled} value={current ? (pixelSizeDrafts[current.id] ?? String(current.settings.pixelation.size)) : "8"} onChange={(event) => { if (!current) return; setPixelSizeDrafts((values) => ({ ...values, [current.id]: event.target.value })); }} onBlur={commitPixelSize} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></div><input type="range" aria-label={tr("픽셀화 블록 크기 슬라이더")} min="2" max="64" step="1" disabled={!current || !current.settings.pixelation.enabled} value={current?.settings.pixelation.size ?? 8} onChange={(event) => { if (current) setPixelSizeDrafts((values) => { const next = { ...values }; delete next[current.id]; return next; }); updateSettings((settings) => { settings.pixelation.size = Number(event.target.value); return settings; }); }} /></div>
              <label className="pixelation-option"><span>{tr("투명도 방식")}</span><select aria-label={tr("픽셀화 투명도 방식")} disabled={!current || !current.settings.pixelation.enabled} value={current?.settings.pixelation.alphaMode ?? "smooth"} onChange={(event) => updateSettings((settings) => { settings.pixelation.alphaMode = event.target.value; return settings; })}><option value="smooth">{tr("부드러운 알파")}</option><option value="binary">{tr("0 · 1 알파 (불투명 픽셀)")}</option></select></label>
              <small className="pixelation-help">{tr("0 · 1 알파는 블록 평균 불투명도가 50% 이상일 때만 완전 불투명하게 만듭니다.")}</small>
            </div>
          </section>

          <section className="panel control-section">
            <div className="panel-title compact"><div><div className="section-kicker"><span className="eyebrow">PALETTE</span><SectionHelp label={tr("최종 팔레트 도움말 열기")} title={tr("최종 팔레트")} summary={tr("변환 결과에 실제로 사용할 색을 결정하는 곳입니다. 먼저 색상 수를 정하고 필요하면 특정 색을 고정하세요.")}><ul><li><strong>{tr("자동·색 고정·고정")}</strong>{tr("자동은 색과 가중치를 계산하고, 색 고정은 선택한 색만 유지하며, 고정은 색과 가중치를 모두 유지합니다.")}</li><li><strong>{tr("가중치")}</strong>{tr("값을 높이면 그 색과 비슷한 픽셀이 더 많이 해당 색으로 변환됩니다.")}</li><li><strong>{tr("자동 팔레트 성향")}</strong>{tr("왼쪽은 이미지에서 많이 쓰인 색을 우선하고, 오른쪽은 서로 다른 색을 다양하게 선택합니다.")}</li><li><strong>{tr("면 정리 강도")}</strong>{tr("낮으면 작은 색 디테일을 살리고, 높으면 자잘한 색 얼룩을 줄여 넓은 면을 깔끔하게 만듭니다.")}</li></ul></SectionHelp></div><h2>{tr("최종 팔레트")}</h2></div><div className="palette-title-actions"><span className="fixed-count">{tr("고정 {count}", { count: fixedCount })}</span><button className="text-button" disabled={!current} onClick={() => setPresetDialogOpen(true)}>{tr("프리셋")}</button><button className="text-button" disabled={!current} title={tr("모든 고정 색상과 가중치 초기화")} onClick={resetPaletteSlots}>{tr("초기화")}</button></div></div>
            <label className="count-field"><span>{tr("최종 색상 수")}<small>{tr("최대 {max}", { max: MAX_COLORS })}</small></span><input type="number" min="1" max={MAX_COLORS} value={current?.settings.colorCount ?? 5} disabled={!current} onChange={(event) => changeCount(event.target.value)} /></label>
            <div className="palette-tuning">
              <label><span><strong>{tr("자동 팔레트 성향")}</strong><input className="palette-tendency-number compact-number-input" type="number" inputMode="numeric" aria-label={tr("자동 팔레트 성향 숫자")} min="-50" max="50" step="1" disabled={!current} value={current ? (paletteTendencyDrafts[current.id] ?? String(current.settings.paletteDiversity - 50)) : "0"} onChange={(event) => { if (!current) return; setPaletteTendencyDrafts((values) => ({ ...values, [current.id]: event.target.value })); }} onBlur={commitPaletteTendency} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span><input type="range" aria-label={tr("자동 팔레트 성향")} min="-50" max="50" step="1" disabled={!current} value={(current?.settings.paletteDiversity ?? 50) - 50} onChange={(event) => { if (current) setPaletteTendencyDrafts((values) => { const next = { ...values }; delete next[current.id]; return next; }); updateSettings((settings) => { settings.paletteDiversity = Number(event.target.value) + 50; return settings; }); }} /><small><b>{tr("주조색 우선")}</b><b>{tr("원본 균형")}</b><b>{tr("색상 다양성")}</b></small></label>
              <label className="surface-cleanup"><span><strong>{tr("면 정리 강도")}</strong><input className="surface-cleanup-number compact-number-input" type="number" inputMode="numeric" aria-label={tr("면 정리 강도 숫자")} min="0" max="100" step="1" disabled={!current} value={current ? (surfaceCleanupDrafts[current.id] ?? String(current.settings.surfaceCleanup ?? 50)) : "50"} onChange={(event) => { if (!current) return; setSurfaceCleanupDrafts((values) => ({ ...values, [current.id]: event.target.value })); }} onBlur={commitSurfaceCleanup} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span><input type="range" aria-label={tr("면 정리 강도")} min="0" max="100" step="1" disabled={!current} value={current?.settings.surfaceCleanup ?? 50} onChange={(event) => { if (current) setSurfaceCleanupDrafts((values) => { const next = { ...values }; delete next[current.id]; return next; }); updateSettings((settings) => { settings.surfaceCleanup = Number(event.target.value); return settings; }); }} /><small><b>{tr("디테일 유지")}</b><b>{tr("균형")}</b><b>{tr("깔끔한 면")}</b></small></label>
            </div>
            <div className="palette-list">{current?.settings.slots.map((slot: Slot, index: number) => {
              const color = getPaletteSlotColor(current, index); const hex = rgbToHex(color); const mode = paletteSlotMode(slot);
              const modeLabel = mode === "auto" ? "자동" : mode === "color-fixed" ? "색 고정" : "고정";
              const modeAction = mode === "auto" ? "색상을 고정하고 가중치는 자동으로 유지" : mode === "color-fixed" ? "색상과 현재 가중치를 모두 고정" : "색상과 가중치를 모두 자동으로 전환";
              return <div className={`palette-slot ${slot.fixed ? "is-fixed" : ""} ${mode === "fixed" ? "is-weight-fixed" : ""}`} key={index}>
                <button className="swatch" style={{ background: hex }} onClick={() => openColor(index)} aria-label={tr("{index}번 색상 선택", { index: index + 1 })} />
                <button className="slot-color" onClick={() => openColor(index)}><strong>{hex}</strong><small>RGB {color.join(" · ")}</small></button>
                <button className="slot-tag" type="button" title={tr(modeAction)} aria-label={tr(modeAction)} onClick={() => updateSettings((settings) => cyclePaletteSlotMode(settings, index, color))}>{tr(modeLabel)}</button>
                <label className="weight"><span>{tr("가중치")} · {tr(slot.weightMode === "auto" ? "자동" : "수동")}</span><input type="number" inputMode="decimal" min="0.1" max="5" step="0.1" value={weightDrafts[weightKey(current.id, index)] ?? String(slot.weight)} onChange={(event) => {
                  const key = weightKey(current.id, index); setWeightDrafts((values) => ({ ...values, [key]: event.target.value }));
                }} disabled={!slot.fixed && !slot.color} title={!slot.fixed && !slot.color ? tr("먼저 변환하여 자동 색상을 생성하거나 색상을 고정하세요.") : undefined} onBlur={() => commitWeight(index)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
                <button className="delete-slot" disabled={(current?.settings.colorCount ?? 1) <= 1} title={tr("{index}번 팔레트 색상 삭제", { index: index + 1 })} aria-label={tr("{index}번 팔레트 색상 삭제", { index: index + 1 })} onClick={() => deletePaletteSlot(index)}>×</button>
              </div>;
            })}</div>
          </section>

          <section className="panel control-section">
            <div className="panel-title compact"><div><div className="section-kicker"><span className="eyebrow">EXPORT</span><SectionHelp label={tr("저장 및 내보내기 도움말 열기")} title={tr("저장 및 내보내기")} summary={tr("현재 작업을 나중에 이어서 쓸 설정 파일로 저장하거나, 완성된 이미지를 내려받는 곳입니다.")}><ul><li><strong>{tr("설정 저장")}</strong>{tr("색 보정과 팔레트 값을 JSON 파일로 저장합니다. 원본 이미지는 포함되지 않습니다.")}</li><li><strong>{tr("투명도")}</strong>{tr("PNG와 WebP는 투명도를 유지할 수 있고, JPEG는 선택한 배경색으로 채웁니다.")}</li><li><strong>{tr("픽셀화 해상도")}</strong>{tr("원본 크기를 유지하거나, 블록 하나를 픽셀 하나로 줄인 작은 해상도로 저장할 수 있습니다.")}</li><li><strong>{tr("여러 장 내보내기")}</strong>{tr("현재 이미지만 저장하거나 목록의 모든 이미지를 각각 저장할 수 있습니다.")}</li></ul></SectionHelp></div><h2>{tr("저장 및 내보내기")}</h2></div></div>
            <div className="settings-actions"><button className="button ghost" disabled={!current} onClick={() => setSaveDialogOpen(true)}>{tr("설정 저장")}</button><button className="button ghost" disabled={!current} onClick={() => settingsInput.current?.click()}>{tr("설정 불러오기")}</button><input ref={settingsInput} hidden type="file" accept="application/json,.json" onChange={loadSettings} /></div>
            <div className="export-grid">
              <label><span>{tr("형식")}</span><select disabled={!current} value={current?.settings.export.format ?? "png"} onChange={(event) => updateSettings((settings) => { settings.export.format = event.target.value; if (event.target.value === "jpeg") settings.export.preserveAlpha = false; return settings; }, false)}><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label>
              <label><span>{tr("품질")}</span><input type="number" min="0.1" max="1" step="0.01" disabled={!current || current.settings.export.format === "png"} value={current?.settings.export.quality ?? .92} onChange={(event) => updateSettings((settings) => { const q = Number(event.target.value); if (q >= .1 && q <= 1) settings.export.quality = q; return settings; }, false)} /></label>
              <label className="wide"><span>{tr("파일명")}</span><input disabled={!current} value={current?.settings.export.fileName ?? "converted"} onChange={(event) => updateSettings((settings) => { settings.export.fileName = event.target.value; return settings; }, false)} /></label>
              <label><span>{tr("배경색")}</span><input type="color" disabled={!current} value={current?.settings.export.background ?? "#ffffff"} onChange={(event) => updateSettings((settings) => { settings.export.background = event.target.value.toUpperCase(); return settings; }, false)} /></label>
              <label className="check"><input type="checkbox" disabled={!current || current.settings.export.format === "jpeg"} checked={current?.settings.export.preserveAlpha ?? true} onChange={(event) => updateSettings((settings) => { settings.export.preserveAlpha = event.target.checked; return settings; }, false)} /><span>{tr("투명도 유지")}</span></label>
              <label className="wide"><span>{tr("픽셀화 출력 해상도")}</span><select aria-label={tr("픽셀화 출력 해상도")} disabled={!current || !current.settings.pixelation.enabled} value={current?.settings.export.keepOriginalSize === false ? "optimized" : "original"} onChange={(event) => updateSettings((settings) => { settings.export.keepOriginalSize = event.target.value === "original"; return settings; }, false)}><option value="original">{tr("원본 해상도 유지")}{current ? ` (${current.width} × ${current.height})` : ""}</option><option value="optimized">{tr("픽셀 최적화")}{current ? ` (${Math.ceil(current.width / current.settings.pixelation.size)} × ${Math.ceil(current.height / current.settings.pixelation.size)})` : ""}</option></select></label>
            </div>
            {current?.hasAlpha && current.settings.export.format === "jpeg" && <p className="warning">{tr("JPEG는 투명도를 지원하지 않아 선택한 배경색으로 합성됩니다.")}</p>}
            <div className="export-actions"><button className="button primary" disabled={!current || busy} onClick={exportCurrent}>{tr("현재 이미지 내보내기")}</button><button className="button ghost" disabled={!images.length || busy} onClick={exportAll}>{tr("전체 내보내기")}</button></div>
          </section>
        </aside>
      <AdPlacement placement="banner" slot={AD_SLOTS.banner} label="Advertisements" pendingText={tr("\uC2B9\uC778 \uD6C4 \uAD11\uACE0\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.")} />
      </div>

      <footer className="studio-footer"><div><strong>Palette Forge</strong><span>{tr("이미지와 영상은 서버로 전송되지 않고 브라우저 안에서 처리됩니다.")}</span></div><nav aria-label={tr("사이트 정보")}><a href="/guide">{tr("서비스 안내")}</a><a href="/privacy">{tr("개인정보처리방침")}</a><a href="/terms">{tr("이용약관")}</a><a href="/guide#contact">{tr("문의")}</a></nav><small>© 2026 Palette Forge</small></footer>

      {videoDialogOpen && <Suspense fallback={<div className="modal-backdrop video-modal-backdrop"><div className="video-loading">{tr("영상 변환 준비")}</div></div>}><VideoConverter open language={language} onClose={() => setVideoDialogOpen(false)} /></Suspense>}

      {presetDialogOpen && current && <div className="modal-backdrop">
        <section className="color-dialog preset-dialog" role="dialog" aria-modal="true" aria-label={tr("팔레트 프리셋")}>
          <div className="dialog-head"><div><span className="eyebrow">PALETTE PRESETS</span><h2>{tr("팔레트 프리셋")}</h2></div><button className="icon-button" aria-label={tr("팔레트 프리셋 창 닫기")} onClick={() => setPresetDialogOpen(false)}>×</button></div>
          <p className="preset-dialog-intro">{tr("원하는 팔레트를 선택하면 색상 수와 고정 슬롯에 즉시 적용됩니다.")}</p>
          <div className="preset-grid">
            {PALETTE_PRESETS.map((preset) => <button type="button" className="preset-card" key={preset.id} onClick={() => selectPalettePreset(preset)}>
              <span className="preset-swatches" aria-hidden="true">{preset.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
              <span className="preset-meta"><strong>{tr(preset.name)}</strong><small>{tr("{name} · {count}색", { name: tr(preset.name), count: preset.colors.length })}</small></span>
            </button>)}
          </div>
        </section>
      </div>}
      {saveDialogOpen && current && <div className="modal-backdrop">
        <section className="color-dialog settings-dialog" role="dialog" aria-modal="true" aria-label={tr("저장할 설정 선택")}>
          <div className="dialog-head"><div><span className="eyebrow">SAVE SETTINGS</span><h2>{tr("저장할 설정 선택")}</h2></div><button className="icon-button" aria-label={tr("설정 저장 창 닫기")} onClick={() => setSaveDialogOpen(false)}>×</button></div>
          <p className="settings-dialog-intro">{tr("파일에 포함할 항목을 선택하세요. 하나 이상 선택해야 합니다.")}</p>
          <div className="settings-scope-list">
            <label htmlFor="save-adjust" aria-label={tr("ADJUST 색 보정 설정 저장")} className={saveSections.adjust ? "is-selected" : ""}>
              <input id="save-adjust" type="checkbox" checked={saveSections.adjust} onChange={(event) => setSaveSections((sections) => ({ ...sections, adjust: event.target.checked }))} />
              <span><strong>{tr("ADJUST · 색 보정")}</strong><small>{tr("밝기, 대비, 채도, 색조와 픽셀화 설정")}</small></span>
            </label>
            <label htmlFor="save-palette" aria-label={tr("PALETTE 최종 팔레트 설정 저장")} className={saveSections.palette ? "is-selected" : ""}>
              <input id="save-palette" type="checkbox" checked={saveSections.palette} onChange={(event) => setSaveSections((sections) => ({ ...sections, palette: event.target.checked }))} />
                <span><strong>{tr("PALETTE · 최종 팔레트")}</strong><small>{tr("색상 수, 자동 팔레트 성향, 면 정리 강도, 고정 색상과 가중치")}</small></span>
            </label>
          </div>
          <p className="settings-dialog-note">{tr("내보내기 형식, 파일명, 투명도 설정은 항상 함께 저장됩니다. 불러올 때 선택하지 않았던 항목은 현재 이미지의 설정을 유지합니다.")}</p>
          <div className="dialog-footer"><button className="button ghost" onClick={() => setSaveDialogOpen(false)}>{tr("취소")}</button><button className="button primary" disabled={!saveSections.adjust && !saveSections.palette} onClick={saveSettings}>{tr("선택 항목 저장")}</button></div>
        </section>
      </div>}

      {activeSlot !== null && current && !sampling && <div className="modal-backdrop">
        <section className="color-dialog" role="dialog" aria-modal="true" aria-label={tr("색상 선택기")}>
          <div className="dialog-head"><div><span className="eyebrow">COLOR PICKER</span><h2>{tr("{index}번 슬롯 색상", { index: activeSlot + 1 })}</h2></div><button className="icon-button" aria-label={tr("취소")} onClick={() => { setActiveSlot(null); setSamplingSlot(null); }}>×</button></div>
          <div className="color-picker-area" style={{ backgroundColor: `hsl(${draftHsv[0]} 100% 50%)` }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateSaturationValue(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateSaturationValue(event); }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} aria-label={tr("채도와 밝기 선택 영역")}>
            <span className="color-picker-cursor" style={{ left: `${draftHsv[1]}%`, top: `${100 - draftHsv[2]}%` }} />
          </div>
          <div className="hue-control"><span className="current-color" style={{ background: draftHex }} /><input className="hue-slider" type="range" min="0" max="359" value={Math.round(draftHsv[0])} onChange={(event) => { const hue = Number(event.target.value); setDraftColor(hsvToRgb([hue, draftHsv[1], draftHsv[2]]), hue); }} aria-label={tr("색조")} /><output>{Math.round(draftHsv[0])}°</output></div>
          <label className="hex-field"><span>HEX</span><input value={draftHex} onChange={(event) => syncHex(event.target.value)} spellCheck={false} /></label>
          <div className="rgb-fields">{["R", "G", "B"].map((label, index) => <label key={label}><span>{label}</span><input inputMode="numeric" value={draftRgb[index]} onChange={(event) => syncRgb(index, event.target.value)} /></label>)}</div>
          {colorError && <p className="field-error">{colorError}</p>}
          <div className="picker-actions"><button className={`button ghost ${sampling ? "active" : ""}`} onClick={() => { setSamplingSlot(activeSlot); setActiveSlot(null); notify(tr("원본 또는 결과 이미지에서 원하는 픽셀을 클릭하세요.")); }}>⌾ {tr("이미지 스포이드")}</button><button className="button ghost" onClick={screenPick}>⌖ {tr("화면 스포이드")}</button></div>
          <p className="picker-note">{tr("화면 스포이드는 지원 브라우저에서만 사용할 수 있습니다. 완전 투명 픽셀은 선택되지 않습니다.")}</p>
          <div className="dialog-footer"><button className="button ghost" onClick={() => { setActiveSlot(null); setSamplingSlot(null); }}>{tr("취소")}</button><button className="button primary" onClick={applyDraft}>{tr("색상 고정")}</button></div>
        </section>
      </div>}
    </main>
  );
}
