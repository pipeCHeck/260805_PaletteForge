"use client";

import { ChangeEvent, MouseEvent, PointerEvent as ReactPointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  MAX_COLORS,
  cloneSettings,
  defaultSettings,
  deserializeSettings,
  fixPaletteSlot,
  hexToRgb,
  normalizeSlotCount,
  parsePaletteWeight,
  rgbToHex,
  serializeSettings,
} from "../lib/palette.mjs";
import QuantizeWorker from "./quantize.worker?worker";

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

function CanvasPreview({ item, result, onPick }: { item: ImageItem; result: boolean; onPick: (rgb: RGB | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const moved = useRef(false);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const pixels = result ? item.result : item.original;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !pixels) return;
    canvas.width = item.width;
    canvas.height = item.height;
    canvas.getContext("2d", { willReadFrequently: true })?.putImageData(new ImageData(new Uint8ClampedArray(pixels), item.width, item.height), 0, 0);
  }, [item.height, item.width, pixels]);

  const click = (event: MouseEvent<HTMLCanvasElement>) => {
    if (moved.current) { moved.current = false; return; }
    const canvas = ref.current;
    if (!canvas || !pixels) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(item.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) * item.width / rect.width)));
    const y = Math.min(item.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) * item.height / rect.height)));
    const index = (y * item.width + x) * 4;
    onPick(pixels[index + 3] === 0 ? null : [pixels[index], pixels[index + 1], pixels[index + 2]]);
  };

  const adjustment = item.settings.adjustments;
  const filter = result ? undefined : `brightness(${100 + adjustment.brightness}%) contrast(${100 + adjustment.contrast}%) saturate(${100 + adjustment.saturation}%) hue-rotate(${adjustment.hue}deg)`;
  const zoomWithWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setView((current) => {
      const zoom = Math.min(8, Math.max(0.5, current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
      return zoom <= 1 ? { zoom, x: 0, y: 0 } : { ...current, zoom };
    });
  };
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || view.zoom <= 1 || (event.target as HTMLElement).closest("button")) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
    moved.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    setView((current) => ({ ...current, x: active.originX + dx, y: active.originY + dy }));
  };
  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const resetView = () => setView({ zoom: 1, x: 0, y: 0 });
  return <div className={`pan-zoom-viewport ${isDragging ? "is-dragging" : ""}`} onWheel={zoomWithWheel} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onDoubleClick={resetView}>
    <canvas ref={ref} onClick={click} draggable={false} style={{ filter, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }} aria-label={result ? "변환 결과 이미지" : "색 보정이 적용된 원본 이미지"} />
    <div className="zoom-controls"><span>{Math.round(view.zoom * 100)}%</span><button type="button" onClick={resetView} disabled={view.zoom === 1 && view.x === 0 && view.y === 0}>화면 맞춤</button></div>
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

function processInWorker(item: ImageItem): Promise<{ result: Uint8ClampedArray; palette: RGB[] }> {
  return new Promise((resolve, reject) => {
    const worker = new QuantizeWorker();
    const copy = new Uint8ClampedArray(item.original);
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve({ result: new Uint8ClampedArray(event.data.result), palette: event.data.palette });
    };
    worker.onerror = () => { worker.terminate(); reject(new Error("이미지 변환 작업을 시작하지 못했습니다.")); };
    worker.postMessage({ pixels: copy.buffer, settings: item.settings }, [copy.buffer]);
  });
}

async function exportBlob(item: ImageItem) {
  if (!item.result) throw new Error("먼저 이미지를 변환해주세요.");
  const staging = document.createElement("canvas");
  staging.width = item.width; staging.height = item.height;
  staging.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(item.result), item.width, item.height), 0, 0);
  const canvas = document.createElement("canvas");
  canvas.width = item.width; canvas.height = item.height;
  const context = canvas.getContext("2d")!;
  const flatten = item.settings.export.format === "jpeg" || !item.settings.export.preserveAlpha;
  if (flatten) {
    context.fillStyle = item.settings.export.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(staging, 0, 0);
  const mime = `image/${item.settings.export.format}`;
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이 브라우저에서 선택한 형식으로 내보낼 수 없습니다.")), mime, item.settings.export.quality));
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
  const [colorError, setColorError] = useState("");
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const settingsInput = useRef<HTMLInputElement>(null);
  const nativeColorInput = useRef<HTMLInputElement>(null);
  const current = images.find((image) => image.id === selectedId) ?? null;
  const sampling = samplingSlot !== null;

  const notify = (text: string, type: "info" | "error" | "success" = "info") => { setMessage(text); setMessageType(type); };
  const replace = (id: string, updater: (item: ImageItem) => ImageItem) => setImages((items) => items.map((item) => item.id === id ? updater(item) : item));
  const updateCurrent = (updater: (item: ImageItem) => ImageItem) => { if (current) replace(current.id, updater); };
  const updateSettings = (updater: (settings: Settings) => Settings, invalidateResult = true) => updateCurrent((item) => {
    const settings = normalizeSlotCount(updater(cloneSettings(item.settings)));
    return { ...item, settings, result: invalidateResult ? null : item.result };
  });

  const loadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    const loaded: ImageItem[] = [];
    const errors: string[] = [];
    for (const file of files) {
      if (!SUPPORTED_TYPES.has(file.type)) { errors.push(`${file.name}: PNG, JPEG, WebP만 지원합니다.`); continue; }
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        context.drawImage(bitmap, 0, 0); bitmap.close();
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const settings = defaultSettings();
        settings.export.fileName = `${baseName(file.name)}-converted`;
        const hasAlpha = containsTransparency(imageData.data);
        loaded.push({
          id: crypto.randomUUID(), name: file.name, width: canvas.width, height: canvas.height,
          original: imageData.data, result: null, palette: [], settings,
          thumbnail: createThumbnail(canvas, hasAlpha),
          hasAlpha,
        });
      } catch { errors.push(`${file.name}: 파일이 손상되었거나 디코딩할 수 없습니다.`); }
    }
    if (loaded.length) {
      setImages((items) => [...items, ...loaded]);
      setSelectedId((id) => id ?? loaded[0].id);
    }
    setBusy(false);
    if (errors.length) notify(errors.join(" "), "error");
    else notify(`${loaded.length}개 이미지를 원본 순서대로 불러왔습니다.`, "success");
  };

  const changeCount = (value: string) => {
    if (!current) return;
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > MAX_COLORS) { notify(`최종 색상 수는 1~${MAX_COLORS}의 정수여야 합니다.`, "error"); return; }
    const removedFixed = current.settings.slots.slice(count).some((slot: Slot) => slot.fixed);
    if (removedFixed && !window.confirm("범위를 벗어나는 고정 색상이 있습니다. 해당 슬롯을 삭제할까요?")) return;
    updateSettings((settings) => {
      settings.colorCount = count;
      settings.slots = settings.slots.slice(0, count);
      while (settings.slots.length < count) settings.slots.push({ fixed: false, color: null, weight: 1 });
      return settings;
    });
    notify(`팔레트 슬롯을 ${count}개로 변경했습니다.`);
  };

  const openColor = (index: number) => {
    if (!current) return;
    const color = current.settings.slots[index].color ?? current.palette[index] ?? [0, 0, 0];
    flushSync(() => {
      setActiveSlot(index); setDraftHex(rgbToHex(color)); setDraftRgb(color.map(String) as [string, string, string]); setColorError("");
    });
    try { nativeColorInput.current?.showPicker(); }
    catch { /* showPicker 미지원 환경에서는 열린 HEX/RGB 선택기를 그대로 사용합니다. */ }
  };

  const applyColor = (rgb: RGB, slotIndex: number | null = activeSlot) => {
    if (slotIndex === null) return;
    updateSettings((settings) => fixPaletteSlot(settings, slotIndex, rgb));
    setDraftHex(rgbToHex(rgb)); setDraftRgb(rgb.map(String) as [string, string, string]); setColorError(""); setSamplingSlot(null);
  };

  const applyDraft = () => {
    const fromHex = hexToRgb(draftHex);
    const values = draftRgb.map(Number);
    const rgbValid = values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255);
    if (!fromHex || !rgbValid || rgbToHex(values) !== draftHex.toUpperCase()) { setColorError("HEX는 #RRGGBB, RGB는 각각 0~255로 입력하고 서로 일치시켜주세요."); return; }
    applyColor(values as RGB); setActiveSlot(null);
  };

  const syncHex = (value: string) => {
    setDraftHex(value.toUpperCase()); const rgb = hexToRgb(value);
    if (rgb) { setDraftRgb(rgb.map(String) as [string, string, string]); setColorError(""); }
  };

  const syncRgb = (index: number, value: string) => {
    const next = [...draftRgb] as [string, string, string]; next[index] = value; setDraftRgb(next);
    const values = next.map(Number);
    if (values.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) { setDraftHex(rgbToHex(values)); setColorError(""); }
  };

  const pick = (rgb: RGB | null) => {
    if (samplingSlot === null) return;
    if (!rgb) { notify("완전 투명한 픽셀에서는 색상을 가져올 수 없습니다.", "error"); return; }
    applyColor(rgb, samplingSlot); setActiveSlot(null); notify(`${rgbToHex(rgb)} 색상을 고정하고 팔레트에 반영했습니다.`, "success");
  };

  const screenPick = async () => {
    const EyeDropperClass = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!EyeDropperClass) { notify("이 브라우저는 화면 전체 스포이드를 지원하지 않습니다. 이미지 내부 스포이드를 사용해주세요.", "error"); return; }
    const slotIndex = activeSlot;
    try { const result = await new EyeDropperClass().open(); const rgb = hexToRgb(result.sRGBHex); if (rgb) { applyColor(rgb as RGB, slotIndex); setActiveSlot(null); notify(`${rgbToHex(rgb)} 색상을 고정하고 팔레트에 반영했습니다.`, "success"); } }
    catch { notify("화면 스포이드 선택을 취소했습니다."); }
  };

  const convertOne = async (item: ImageItem) => {
    const converted = await processInWorker(item);
    const settings = cloneSettings(item.settings);
    settings.slots = settings.slots.map((slot: Slot, index: number) => ({ ...slot, color: slot.fixed ? slot.color : converted.palette[index] }));
    return { ...item, result: converted.result, palette: converted.palette, settings };
  };

  const convertCurrent = async () => {
    if (!current || busy) return;
    setBusy(true); notify("원본 해상도로 변환하고 있습니다…");
    try { const updated = await convertOne(current); replace(current.id, () => updated); notify("변환이 완료되었습니다.", "success"); }
    catch (error) { notify(error instanceof Error ? error.message : "이미지 변환에 실패했습니다.", "error"); }
    finally { setBusy(false); }
  };

  const saveSettings = () => {
    if (!current) return;
    try { download(new Blob([serializeSettings(current.settings)], { type: "application/json" }), `${baseName(current.name)}-palette-settings.json`); notify("설정 파일을 저장했습니다.", "success"); }
    catch (error) { notify(error instanceof Error ? error.message : "설정 저장에 실패했습니다.", "error"); }
  };

  const loadSettings = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !current) return;
    try { const settings = deserializeSettings(await file.text()); updateCurrent((item) => ({ ...item, settings, result: null, palette: [] })); notify("설정을 현재 이미지에 적용했습니다.", "success"); }
    catch (error) { notify(error instanceof Error ? error.message : "설정 파일을 불러오지 못했습니다.", "error"); }
  };

  const exportCurrent = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const item = current.result ? current : await convertOne(current);
      if (!current.result) replace(current.id, () => item);
      const blob = await exportBlob(item);
      download(blob, `${item.settings.export.fileName}.${item.settings.export.format === "jpeg" ? "jpg" : item.settings.export.format}`);
      notify("현재 이미지를 내보냈습니다.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "이미지 내보내기에 실패했습니다.", "error"); }
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
        download(await exportBlob(item), name);
      } catch { failures.push(source.name); updated.push(source); }
    }
    setImages(updated); setBusy(false);
    if (failures.length) notify(`일부 이미지 내보내기에 실패했습니다: ${failures.join(", ")}`, "error");
    else notify(`${images.length}개 이미지를 각각 내보냈습니다.`, "success");
  };

  const fixedCount = current?.settings.slots.filter((slot: Slot) => slot.fixed).length ?? 0;
  const weightKey = (imageId: string, index: number) => `${imageId}:${index}`;
  const commitWeight = (index: number) => {
    if (!current) return;
    const key = weightKey(current.id, index);
    const draft = weightDrafts[key] ?? String(current.settings.slots[index].weight);
    const weight = parsePaletteWeight(draft);
    setWeightDrafts((values) => { const next = { ...values }; delete next[key]; return next; });
    if (weight === null) { notify("가중치는 0.1~5 사이의 숫자여야 합니다. 기존 값으로 되돌렸습니다.", "error"); return; }
    updateSettings((settings) => { settings.slots[index].weight = weight; return settings; });
  };
  const adjustmentFields = useMemo(() => [
    ["brightness", "밝기", -100, 100], ["contrast", "대비", -100, 100],
    ["saturation", "채도", -100, 100], ["hue", "색조", -180, 180],
  ] as const, []);

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">PF</span><div><h1>Palette Forge</h1><p>정확한 고정 색상을 지키는 로컬 이미지 양자화</p></div></div>
        <div className="header-actions">
          <button className="button ghost" onClick={() => fileInput.current?.click()} disabled={busy}>이미지 추가</button>
          <button className="button primary" onClick={convertCurrent} disabled={!current || busy}>{busy ? "처리 중…" : "변환 실행"}</button>
        </div>
        <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={loadImages} />
      </header>

      <div className={`notice ${messageType}`} role="status"><span>{messageType === "error" ? "!" : messageType === "success" ? "✓" : "i"}</span>{message}</div>

      <div className="workspace">
        <aside className="image-rail panel">
          <div className="panel-title"><div><span className="eyebrow">SOURCE</span><h2>이미지 목록 <b>{images.length}</b></h2></div><button className="icon-button" aria-label="이미지 추가" onClick={() => fileInput.current?.click()}>＋</button></div>
          <button className="dropzone" onClick={() => fileInput.current?.click()} disabled={busy}><span>＋</span><strong>이미지 불러오기</strong><small>PNG · JPEG · WebP / 여러 장 선택 가능</small></button>
          <div className="image-list">
            {images.map((image, index) => <button key={image.id} className={`image-item ${selectedId === image.id ? "selected" : ""}`} onClick={() => { setSelectedId(image.id); setActiveSlot(null); setSamplingSlot(null); }}>
              {/* Object URL이 아닌 메모리 내 썸네일이므로 Next Image 최적화 대상이 아닙니다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumbnail} alt="" /><span className="image-copy"><strong>{image.name}</strong><small>{image.width} × {image.height}px · #{index + 1}</small></span><i className={image.result ? "done" : "pending"}>{image.result ? "완료" : "대기"}</i>
            </button>)}
            {!images.length && <p className="empty-list">불러온 이미지가 없습니다.</p>}
          </div>
          {!!images.length && <div className="rail-actions"><button className="text-button danger" onClick={() => { if (!current) return; setImages((items) => items.filter((item) => item.id !== current.id)); const next = images.find((item) => item.id !== current.id); setSelectedId(next?.id ?? null); }}>선택 삭제</button><button className="text-button" onClick={() => { if (window.confirm("모든 이미지를 목록에서 삭제할까요?")) { setImages([]); setSelectedId(null); } }}>전체 삭제</button></div>}
        </aside>

        <section className="preview-panel panel">
          <div className="panel-title"><div><span className="eyebrow">PREVIEW</span><h2>{current?.name ?? "미리보기"}</h2></div>{current && <span className="dimension">{current.width} × {current.height}px</span>}</div>
          {current ? <div className={`compare ${sampling ? "sampling" : ""}`}>
            <figure><figcaption><span>원본 + 보정 미리보기</span><small>휠 확대 · 드래그 이동 · 클릭 색상 추출</small></figcaption><div className="canvas-wrap checker"><CanvasPreview key={`${current.id}-original`} item={current} result={false} onPick={pick} /></div></figure>
            <figure><figcaption><span>변환 결과</span><small>{current.result ? `${current.palette.length}색 · 휠 확대 · 드래그 이동` : "변환 전"}</small></figcaption><div className="canvas-wrap checker">{current.result ? <CanvasPreview key={`${current.id}-result`} item={current} result onPick={pick} /> : <div className="result-placeholder"><span>◇</span><p>변환 실행 후 결과가 표시됩니다.</p></div>}</div></figure>
          </div> : <div className="empty-preview"><span className="empty-glyph">◫</span><h2>색을 다듬을 이미지를 불러오세요</h2><p>파일은 업로드되지 않으며 원본 해상도로 브라우저 안에서 처리됩니다.</p><button className="button primary" onClick={() => fileInput.current?.click()}>이미지 선택</button></div>}
        </section>

        <aside className="control-panel">
          <section className="panel control-section">
            <div className="panel-title compact"><div><span className="eyebrow">ADJUST</span><h2>색 보정</h2></div>{current && <button className="text-button" onClick={() => updateSettings((settings) => { settings.adjustments = defaultSettings().adjustments; return settings; })}>초기화</button>}</div>
            <p className="section-note">원본에서 다시 계산되며 보정값이 누적되지 않습니다.</p>
            <div className="sliders">{adjustmentFields.map(([key, label, min, max]) => <label key={key}><span>{label}<output>{current?.settings.adjustments[key] ?? 0}{key === "hue" ? "°" : ""}</output></span><input type="range" min={min} max={max} value={current?.settings.adjustments[key] ?? 0} disabled={!current} onChange={(event) => updateSettings((settings) => { settings.adjustments[key] = Number(event.target.value); return settings; })} /></label>)}</div>
          </section>

          <section className="panel control-section">
            <div className="panel-title compact"><div><span className="eyebrow">PALETTE</span><h2>최종 팔레트</h2></div><span className="fixed-count">고정 {fixedCount}</span></div>
            <label className="count-field"><span>최종 색상 수<small>최대 {MAX_COLORS}</small></span><input type="number" min="1" max={MAX_COLORS} value={current?.settings.colorCount ?? 5} disabled={!current} onChange={(event) => changeCount(event.target.value)} /></label>
            <div className="palette-list">{current?.settings.slots.map((slot: Slot, index: number) => {
              const color = slot.color ?? current.palette[index] ?? [218, 218, 213]; const hex = rgbToHex(color);
              return <div className={`palette-slot ${slot.fixed ? "is-fixed" : ""}`} key={index}>
                <button className="swatch" style={{ background: hex }} onClick={() => openColor(index)} aria-label={`${index + 1}번 색상 선택`} />
                <button className="slot-color" onClick={() => openColor(index)}><strong>{hex}</strong><small>RGB {color.join(" · ")}</small></button>
                <span className="slot-tag">{slot.fixed ? "고정" : "자동"}</span>
                <label className="weight"><span>가중치</span><input type="number" inputMode="decimal" min="0.1" max="5" step="0.1" value={weightDrafts[weightKey(current.id, index)] ?? String(slot.weight)} onChange={(event) => {
                  const key = weightKey(current.id, index); setWeightDrafts((values) => ({ ...values, [key]: event.target.value }));
                }} onBlur={() => commitWeight(index)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
                <button className="reset-slot" title="고정 해제 및 가중치 초기화" onClick={() => updateSettings((settings) => { settings.slots[index] = { fixed: false, color: null, weight: 1 }; return settings; })}>↺</button>
              </div>;
            })}</div>
          </section>

          <section className="panel control-section">
            <div className="panel-title compact"><div><span className="eyebrow">EXPORT</span><h2>저장 및 내보내기</h2></div></div>
            <div className="settings-actions"><button className="button ghost" disabled={!current} onClick={saveSettings}>설정 저장</button><button className="button ghost" disabled={!current} onClick={() => settingsInput.current?.click()}>설정 불러오기</button><input ref={settingsInput} hidden type="file" accept="application/json,.json" onChange={loadSettings} /></div>
            <div className="export-grid">
              <label><span>형식</span><select disabled={!current} value={current?.settings.export.format ?? "png"} onChange={(event) => updateSettings((settings) => { settings.export.format = event.target.value; if (event.target.value === "jpeg") settings.export.preserveAlpha = false; return settings; }, false)}><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label>
              <label><span>품질</span><input type="number" min="0.1" max="1" step="0.01" disabled={!current || current.settings.export.format === "png"} value={current?.settings.export.quality ?? .92} onChange={(event) => updateSettings((settings) => { const q = Number(event.target.value); if (q >= .1 && q <= 1) settings.export.quality = q; return settings; }, false)} /></label>
              <label className="wide"><span>파일명</span><input disabled={!current} value={current?.settings.export.fileName ?? "converted"} onChange={(event) => updateSettings((settings) => { settings.export.fileName = event.target.value; return settings; }, false)} /></label>
              <label><span>배경색</span><input type="color" disabled={!current} value={current?.settings.export.background ?? "#ffffff"} onChange={(event) => updateSettings((settings) => { settings.export.background = event.target.value.toUpperCase(); return settings; }, false)} /></label>
              <label className="check"><input type="checkbox" disabled={!current || current.settings.export.format === "jpeg"} checked={current?.settings.export.preserveAlpha ?? true} onChange={(event) => updateSettings((settings) => { settings.export.preserveAlpha = event.target.checked; return settings; }, false)} /><span>투명도 유지</span></label>
              <label className="check"><input type="checkbox" checked readOnly disabled /><span>원본 크기 유지</span></label>
            </div>
            {current?.hasAlpha && current.settings.export.format === "jpeg" && <p className="warning">JPEG는 투명도를 지원하지 않아 선택한 배경색으로 합성됩니다.</p>}
            <div className="export-actions"><button className="button primary" disabled={!current || busy} onClick={exportCurrent}>현재 이미지 내보내기</button><button className="button ghost" disabled={!images.length || busy} onClick={exportAll}>전체 내보내기</button></div>
          </section>
        </aside>
      </div>

      {activeSlot !== null && current && !sampling && <div className="modal-backdrop">
        <section className="color-dialog" role="dialog" aria-modal="true" aria-label="색상 선택기">
          <div className="dialog-head"><div><span className="eyebrow">COLOR PICKER</span><h2>{activeSlot + 1}번 슬롯 색상</h2></div><button className="icon-button" onClick={() => { setActiveSlot(null); setSamplingSlot(null); }}>×</button></div>
          <div className="color-visual" style={{ background: hexToRgb(draftHex) ? draftHex : "#000000" }}><input ref={nativeColorInput} type="color" value={hexToRgb(draftHex) ? draftHex : "#000000"} onChange={(event) => syncHex(event.target.value)} aria-label="시각적 색상 선택" /></div>
          <label className="hex-field"><span>HEX</span><input value={draftHex} onChange={(event) => syncHex(event.target.value)} spellCheck={false} /></label>
          <div className="rgb-fields">{["R", "G", "B"].map((label, index) => <label key={label}><span>{label}</span><input inputMode="numeric" value={draftRgb[index]} onChange={(event) => syncRgb(index, event.target.value)} /></label>)}</div>
          {colorError && <p className="field-error">{colorError}</p>}
          <div className="picker-actions"><button className={`button ghost ${sampling ? "active" : ""}`} onClick={() => { setSamplingSlot(activeSlot); setActiveSlot(null); notify("원본 또는 결과 이미지에서 원하는 픽셀을 클릭하세요."); }}>⌾ 이미지 스포이드</button><button className="button ghost" onClick={screenPick}>⌖ 화면 스포이드</button></div>
          <p className="picker-note">화면 스포이드는 지원 브라우저에서만 사용할 수 있습니다. 완전 투명 픽셀은 선택되지 않습니다.</p>
          <div className="dialog-footer"><button className="button ghost" onClick={() => { setActiveSlot(null); setSamplingSlot(null); }}>취소</button><button className="button primary" onClick={applyDraft}>색상 고정</button></div>
        </section>
      </div>}
    </main>
  );
}
