"use client";

import { ChangeEvent, MouseEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_COLORS,
  cloneSettings,
  defaultSettings,
  deserializeSettingsDocument,
  fixPaletteSlot,
  getExportDimensions,
  hexToRgb,
  hsvToRgb,
  normalizeSlotCount,
  parsePaletteWeight,
  rgbToHex,
  rgbToHsv,
  serializeSettings,
} from "../lib/palette.mjs";
import QuantizeWorker from "./quantize.worker?worker";
import { LANGUAGE_OPTIONS, Language, detectLanguage, localizeError, translate } from "./i18n";

type RGB = [number, number, number];
type Slot = { fixed: boolean; color: RGB | null; weight: number };
type Settings = ReturnType<typeof defaultSettings>;
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
};

const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function CanvasPreview({ item, result, onPick, language }: { item: ImageItem; result: boolean; onPick: (rgb: RGB | null) => void; language: Language }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const displayedPixels = useRef<Uint8ClampedArray | null>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const moved = useRef(false);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<{ settings: Settings; state: "ready" | "error" } | null>(null);
  const tr = (source: string, values: Record<string, string | number> = {}) => translate(language, source, values);
  const isPreparing = !result && previewStatus?.settings !== item.settings;
  const previewFailed = !result && previewStatus?.settings === item.settings && previewStatus.state === "error";
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
        if (state === "ready" && pixels) draw(pixels);
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
  }, [item.height, item.original, item.result, item.settings, item.width, result]);

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

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const zoomWithWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setView((current) => {
        const zoom = Math.min(8, Math.max(0.5, current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
        return zoom <= 1 ? { zoom, x: 0, y: 0 } : { ...current, zoom };
      });
    };
    viewport.addEventListener("wheel", zoomWithWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", zoomWithWheel);
  }, []);
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || view.zoom <= 1 || (event.target as HTMLElement).closest("button")) return;
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
  const resetView = () => setView({ zoom: 1, x: 0, y: 0 });
  return <div ref={viewportRef} className={`pan-zoom-viewport ${isDragging ? "is-dragging" : ""} ${isPreparing ? "is-processing" : ""}`} aria-busy={isPreparing} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onDoubleClick={resetView}>
    <canvas ref={ref} onClick={click} draggable={false} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }} aria-label={tr(result ? "변환 결과 이미지" : "색 보정이 적용된 원본 이미지")} />
    {isPreparing && <div className="preview-processing" role="status" aria-live="polite"><i /><span><strong>{tr("미리보기 계산 중…")}</strong><small>{tr("색 보정과 픽셀화를 적용하고 있습니다.")}</small></span></div>}
    {previewFailed && <div className="preview-processing is-error" role="alert"><span><strong>{tr("미리보기를 계산하지 못했습니다.")}</strong><small>{tr("설정을 다시 변경하거나 이미지를 다시 불러와주세요.")}</small></span></div>}
    <div className="zoom-controls"><span>{Math.round(view.zoom * 100)}%</span><button type="button" onClick={resetView} disabled={view.zoom === 1 && view.x === 0 && view.y === 0}>{tr("화면 맞춤")}</button></div>
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

function processInWorker(item: ImageItem, language: Language): Promise<{ result: Uint8ClampedArray; palette: RGB[] }> {
  return new Promise((resolve, reject) => {
    const worker = new QuantizeWorker();
    const copy = new Uint8ClampedArray(item.original);
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.error) reject(new Error(localizeError(language, event.data.error)));
      else resolve({ result: new Uint8ClampedArray(event.data.result), palette: event.data.palette });
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
  const [draftHex, setDraftHex] = useState("#000000");
  const [draftRgb, setDraftRgb] = useState<[string, string, string]>(["0", "0", "0"]);
  const [draftHue, setDraftHue] = useState(0);
  const [colorError, setColorError] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveSections, setSaveSections] = useState({ adjust: true, palette: true });
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});
  const [pixelSizeDrafts, setPixelSizeDrafts] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<Language>("ko");
  const fileInput = useRef<HTMLInputElement>(null);
  const settingsInput = useRef<HTMLInputElement>(null);
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
      setMessage(translate(nextLanguage, "이미지를 불러오면 모든 처리가 이 브라우저 안에서 진행됩니다."));
    }, 0);
    return () => window.clearTimeout(timer);
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
      setSelectedId((id) => id ?? loaded[0].id);
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
      while (settings.slots.length < count) settings.slots.push({ fixed: false, color: null, weight: 1 });
      return settings;
    });
    notify(tr("팔레트 슬롯을 {count}개로 변경했습니다.", { count }));
  };

  const openColor = (index: number) => {
    if (!current) return;
    const color = current.settings.slots[index].color ?? current.palette[index] ?? [0, 0, 0];
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

  const convertOne = async (item: ImageItem) => {
    const converted = await processInWorker(item, language);
    const settings = cloneSettings(item.settings);
    settings.slots = settings.slots.map((slot: Slot, index: number) => ({ ...slot, color: slot.fixed ? slot.color : converted.palette[index] }));
    return { ...item, result: converted.result, palette: converted.palette, settings };
  };

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
  const weightKey = (imageId: string, index: number) => `${imageId}:${index}`;
  const commitWeight = (index: number) => {
    if (!current) return;
    const key = weightKey(current.id, index);
    const draft = weightDrafts[key] ?? String(current.settings.slots[index].weight);
    const weight = parsePaletteWeight(draft);
    setWeightDrafts((values) => { const next = { ...values }; delete next[key]; return next; });
    if (weight === null) { notify(tr("가중치는 0.1~5 사이의 숫자여야 합니다. 기존 값으로 되돌렸습니다."), "error"); return; }
    updateSettings((settings) => { settings.slots[index].weight = weight; return settings; });
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

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">PF</span><div><h1>Palette Forge</h1><p>{tr("정확한 고정 색상을 지키는 로컬 이미지 양자화")}</p></div></div>
        <div className="header-actions">
          <button className="button theme-toggle" type="button" onClick={toggleTheme} aria-pressed={theme === "dark"} aria-label={tr("{mode} 모드로 전환", { mode: tr(theme === "dark" ? "라이트" : "다크") })} title={tr("{mode} 모드로 전환", { mode: tr(theme === "dark" ? "라이트" : "다크") })}><span className="theme-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span className="theme-label">{tr(theme === "dark" ? "라이트" : "다크")}</span></button>
          <label className="language-control"><span aria-hidden="true">文</span><select value={language} aria-label={tr("언어 선택")} onChange={(event) => changeLanguage(event.target.value as Language)}>{LANGUAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          <button className="button ghost" onClick={() => fileInput.current?.click()} disabled={busy}>{tr("이미지 추가")}</button>
          <button className="button primary" onClick={convertCurrent} disabled={!current || busy}>{tr(busy ? "처리 중…" : "변환 실행")}</button>
        </div>
        <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={loadImages} />
      </header>

      <div className={`notice ${messageType}`} role="status"><span>{messageType === "error" ? "!" : messageType === "success" ? "✓" : "i"}</span>{message}</div>

      <div className="workspace">
        <aside className="image-rail panel">
          <div className="panel-title"><div><span className="eyebrow">SOURCE</span><h2>{tr("이미지 목록")} <b>{images.length}</b></h2></div><button className="icon-button" aria-label={tr("이미지 추가")} onClick={() => fileInput.current?.click()}>＋</button></div>
          <button className="dropzone" onClick={() => fileInput.current?.click()} disabled={busy}><span>＋</span><strong>{tr("이미지 불러오기")}</strong><small>{tr("PNG · JPEG · WebP / 여러 장 선택 가능")}</small><small className="paste-hint">{tr("또는 Ctrl+V로 클립보드 이미지 붙여넣기")}</small></button>
          <div className="image-list">
            {images.map((image, index) => <button key={image.id} className={`image-item ${selectedId === image.id ? "selected" : ""}`} onClick={() => { setSelectedId(image.id); setActiveSlot(null); setSamplingSlot(null); }}>
              {/* Object URL이 아닌 메모리 내 썸네일이므로 Next Image 최적화 대상이 아닙니다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumbnail} alt="" /><span className="image-copy"><strong>{image.name}</strong><small>{image.width} × {image.height}px · #{index + 1}</small></span><i className={image.result ? "done" : "pending"}>{tr(image.result ? "완료" : "대기")}</i>
            </button>)}
            {!images.length && <p className="empty-list">{tr("불러온 이미지가 없습니다.")}</p>}
          </div>
          {!!images.length && <div className="rail-actions"><button className="text-button danger" onClick={() => { if (!current) return; setImages((items) => items.filter((item) => item.id !== current.id)); const next = images.find((item) => item.id !== current.id); setSelectedId(next?.id ?? null); }}>{tr("선택 삭제")}</button><button className="text-button" onClick={() => { if (window.confirm(tr("모든 이미지를 목록에서 삭제할까요?"))) { setImages([]); setSelectedId(null); } }}>{tr("전체 삭제")}</button></div>}
        </aside>

        <section className="preview-panel panel">
          <div className="panel-title"><div><span className="eyebrow">PREVIEW</span><h2>{current?.name ?? tr("미리보기")}</h2></div>{current && <span className="dimension">{current.width} × {current.height}px</span>}</div>
          {current ? <div className={`compare ${sampling ? "sampling" : ""}`}>
            <figure><figcaption><span>{tr("원본 + 보정 미리보기")}</span><small>{tr("휠 확대 · 드래그 이동 · 클릭 색상 추출")}</small></figcaption><div className="canvas-wrap checker"><CanvasPreview key={`${current.id}-original`} item={current} result={false} onPick={pick} language={language} /></div></figure>
            <figure><figcaption><span>{tr("변환 결과")}</span><small>{current.result ? tr("{count}색 · 휠 확대 · 드래그 이동", { count: current.palette.length }) : tr("변환 전")}</small></figcaption><div className="canvas-wrap checker">{current.result ? <CanvasPreview key={`${current.id}-result`} item={current} result onPick={pick} language={language} /> : <div className="result-placeholder"><span>◇</span><p>{tr("변환 실행 후 결과가 표시됩니다.")}</p></div>}</div></figure>
          </div> : <div className="empty-preview"><span className="empty-glyph">◫</span><h2>{tr("색을 다듬을 이미지를 불러오세요")}</h2><p>{tr("파일은 업로드되지 않으며 원본 해상도로 브라우저 안에서 처리됩니다.")}</p><button className="button primary" onClick={() => fileInput.current?.click()}>{tr("이미지 선택")}</button></div>}
        </section>

        <aside className="control-panel">
          <section className="panel control-section">
            <div className="panel-title compact"><div><span className="eyebrow">ADJUST</span><h2>{tr("색 보정")}</h2></div>{current && <button className="text-button" onClick={() => updateSettings((settings) => { settings.adjustments = defaultSettings().adjustments; return settings; })}>{tr("초기화")}</button>}</div>
            <p className="section-note">{tr("원본에서 다시 계산되며 보정값이 누적되지 않습니다.")}</p>
            <div className="sliders">{adjustmentFields.map(([key, label, min, max]) => <label key={key}><span>{tr(label)}<output>{current?.settings.adjustments[key] ?? 0}{key === "hue" ? "°" : ""}</output></span><input type="range" min={min} max={max} value={current?.settings.adjustments[key] ?? 0} disabled={!current} onChange={(event) => updateSettings((settings) => { settings.adjustments[key] = Number(event.target.value); return settings; })} /></label>)}</div>
            <div className={`pixelation-setting ${current?.settings.pixelation.enabled ? "is-enabled" : ""}`}>
              <label className="pixelation-toggle"><span><strong>{tr("픽셀화")}</strong><small>{tr("색상 제한 전에 블록 효과 적용")}</small></span><input type="checkbox" aria-label={tr("픽셀화 사용")} disabled={!current} checked={current?.settings.pixelation.enabled ?? false} onChange={(event) => updateSettings((settings) => { settings.pixelation.enabled = event.target.checked; return settings; })} /></label>
              <div className="pixelation-size"><div><span>{tr("블록 크기")}</span><input type="number" inputMode="numeric" aria-label={tr("픽셀화 블록 크기 숫자")} min="2" max="64" step="1" disabled={!current || !current.settings.pixelation.enabled} value={current ? (pixelSizeDrafts[current.id] ?? String(current.settings.pixelation.size)) : "8"} onChange={(event) => { if (!current) return; setPixelSizeDrafts((values) => ({ ...values, [current.id]: event.target.value })); }} onBlur={commitPixelSize} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></div><input type="range" aria-label={tr("픽셀화 블록 크기 슬라이더")} min="2" max="64" step="1" disabled={!current || !current.settings.pixelation.enabled} value={current?.settings.pixelation.size ?? 8} onChange={(event) => { if (current) setPixelSizeDrafts((values) => { const next = { ...values }; delete next[current.id]; return next; }); updateSettings((settings) => { settings.pixelation.size = Number(event.target.value); return settings; }); }} /></div>
              <label className="pixelation-option"><span>{tr("투명도 방식")}</span><select aria-label={tr("픽셀화 투명도 방식")} disabled={!current || !current.settings.pixelation.enabled} value={current?.settings.pixelation.alphaMode ?? "smooth"} onChange={(event) => updateSettings((settings) => { settings.pixelation.alphaMode = event.target.value; return settings; })}><option value="smooth">{tr("부드러운 알파")}</option><option value="binary">{tr("0 · 1 알파 (불투명 픽셀)")}</option></select></label>
              <small className="pixelation-help">{tr("0 · 1 알파는 블록 평균 불투명도가 50% 이상일 때만 완전 불투명하게 만듭니다.")}</small>
            </div>
          </section>

          <section className="panel control-section">
            <div className="panel-title compact"><div><span className="eyebrow">PALETTE</span><h2>{tr("최종 팔레트")}</h2></div><span className="fixed-count">{tr("고정 {count}", { count: fixedCount })}</span></div>
            <label className="count-field"><span>{tr("최종 색상 수")}<small>{tr("최대 {max}", { max: MAX_COLORS })}</small></span><input type="number" min="1" max={MAX_COLORS} value={current?.settings.colorCount ?? 5} disabled={!current} onChange={(event) => changeCount(event.target.value)} /></label>
            <div className="palette-list">{current?.settings.slots.map((slot: Slot, index: number) => {
              const color = slot.color ?? current.palette[index] ?? [218, 218, 213]; const hex = rgbToHex(color);
              return <div className={`palette-slot ${slot.fixed ? "is-fixed" : ""}`} key={index}>
                <button className="swatch" style={{ background: hex }} onClick={() => openColor(index)} aria-label={tr("{index}번 색상 선택", { index: index + 1 })} />
                <button className="slot-color" onClick={() => openColor(index)}><strong>{hex}</strong><small>RGB {color.join(" · ")}</small></button>
                <span className="slot-tag">{tr(slot.fixed ? "고정" : "자동")}</span>
                <label className="weight"><span>{tr("가중치")}</span><input type="number" inputMode="decimal" min="0.1" max="5" step="0.1" value={weightDrafts[weightKey(current.id, index)] ?? String(slot.weight)} onChange={(event) => {
                  const key = weightKey(current.id, index); setWeightDrafts((values) => ({ ...values, [key]: event.target.value }));
                }} onBlur={() => commitWeight(index)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
                <button className="reset-slot" title={tr("고정 해제 및 가중치 초기화")} onClick={() => updateSettings((settings) => { settings.slots[index] = { fixed: false, color: null, weight: 1 }; return settings; })}>↺</button>
              </div>;
            })}</div>
          </section>

          <section className="panel control-section">
            <div className="panel-title compact"><div><span className="eyebrow">EXPORT</span><h2>{tr("저장 및 내보내기")}</h2></div></div>
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
      </div>

      <footer className="studio-footer"><div><strong>Palette Forge</strong><span>{tr("이미지는 서버로 전송되지 않고 브라우저 안에서 처리됩니다.")}</span></div><nav aria-label={tr("사이트 정보")}><a href="/guide">{tr("서비스 안내")}</a><a href="/privacy">{tr("개인정보처리방침")}</a><a href="/terms">{tr("이용약관")}</a><a href="/guide#contact">{tr("문의")}</a></nav><small>© 2026 Palette Forge</small></footer>

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
              <span><strong>{tr("PALETTE · 최종 팔레트")}</strong><small>{tr("색상 수, 슬롯 상태, 고정 색상과 가중치")}</small></span>
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
