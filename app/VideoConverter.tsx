"use client";
/* User-supplied local previews do not have a separate captions file. */
/* eslint-disable jsx-a11y/media-has-caption */

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  VideoSampleSink,
  WebMOutputFormat,
  type VideoCodec,
} from "mediabunny";
import { applyPalettePreset, cloneSettings, cyclePaletteSlotMode, defaultSettings, fixPaletteSlot, fixPaletteSlotWeight, hexToRgb, normalizeSlotCount, paletteSlotMode, removePaletteSlot, resetPaletteSettings, rgbToHex } from "../lib/palette.mjs";
import {
  createAnalysisTimestamps,
  createCommonPaletteSettings,
  createFramePaletteSettings,
  formatVideoElapsedTime,
  isSupportedVideoFile,
  stagedVideoProgress,
  videoOutputDimensions,
  videoOutputSpec,
  videoPaletteSummaryColor,
} from "../lib/video.mjs";
import QuantizeWorker from "./quantize.worker?worker";
import { Language, translate } from "./i18n";

type RGB = [number, number, number];
type Settings = ReturnType<typeof defaultSettings>;
type AdjustmentKey = keyof Settings["adjustments"];
type VideoNumericField = AdjustmentKey | "paletteTendency" | "surfaceCleanup";
type PaletteMode = "common" | "frame";
type VideoPalettePreset = { id: string; name: string; colors: string[] };
const VIDEO_PALETTE_PRESETS: VideoPalettePreset[] = [
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
type VideoInfo = {
  file: File;
  sourceUrl: string;
  width: number;
  height: number;
  duration: number;
  videoCodec: string;
  audioCodec: string | null;
  hasAlpha: boolean;
};
type WorkerResult = { result: Uint8ClampedArray; palette: RGB[]; weights: number[]; sceneCut: boolean; difference: number; frameDifference: number; sceneScore: number };

function quantizeWithWorker(worker: Worker, pixels: Uint8ClampedArray, width: number, height: number, settings: Settings, temporalPaletteEnabled = false) {
  return new Promise<WorkerResult>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ error?: string; result?: ArrayBuffer; palette?: RGB[]; weights?: number[]; sceneCut?: boolean; difference?: number; frameDifference?: number; sceneScore?: number }>) => {
      if (event.data.error || !event.data.result) { reject(new Error(event.data.error || "영상 프레임 변환에 실패했습니다.")); return; }
      resolve({
        result: new Uint8ClampedArray(event.data.result),
        palette: event.data.palette ?? [],
        weights: event.data.weights ?? [],
        sceneCut: event.data.sceneCut ?? false,
        difference: event.data.difference ?? 0,
        frameDifference: event.data.frameDifference ?? 0,
        sceneScore: event.data.sceneScore ?? 0,
      });
    };
    worker.onerror = () => reject(new Error("영상 프레임 작업자를 실행하지 못했습니다."));
    worker.postMessage({ operation: "quantize", pixels: pixels.buffer, width, height, settings, temporalPaletteEnabled }, [pixels.buffer]);
  });
}

function secondsLabel(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "") || "palette-forge-video";
}

function drawLivePreviewFrame(source: HTMLCanvasElement, canvas: HTMLCanvasElement, lastRenderedAt: number, force: boolean, smooth: boolean) {
  const now = performance.now();
  if (!force && now - lastRenderedAt < 250) return null;
  const scale = Math.min(1, 640 / source.width, 360 / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = smooth;
  context.drawImage(source, 0, 0, width, height);
  return now;
}

function currentWorkTime() {
  return performance.now();
}

export default function VideoConverter({
  open,
  language,
  seedSettings,
  onClose,
}: {
  open: boolean;
  language: Language;
  seedSettings: Settings | null;
  onClose: () => void;
}) {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [settings, setSettings] = useState<Settings>(() => normalizeSlotCount(cloneSettings(seedSettings ?? defaultSettings())));
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("common");
  const [presetOpen, setPresetOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "analysis" | "conversion" | "finalizing" | "done" | "error" | "canceled">("idle");
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasWorkTime, setHasWorkTime] = useState(false);
  const [message, setMessage] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultPalette, setResultPalette] = useState<RGB[]>([]);
  const [livePreviewReady, setLivePreviewReady] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [numericDrafts, setNumericDrafts] = useState<Partial<Record<VideoNumericField, string>>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const livePreviewRef = useRef<HTMLCanvasElement>(null);
  const livePreviewReadyRef = useRef(false);
  const lastPreviewAtRef = useRef(0);
  const conversionRef = useRef<Conversion | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const workStartedAtRef = useRef<number | null>(null);
  const cancelRequested = useRef(false);
  const tr = (source: string, values: Record<string, string | number> = {}) => translate(language, source, values);
  const busy = loadingFile || status === "analysis" || status === "conversion" || status === "finalizing";
  const outputSpec = useMemo(() => video ? videoOutputSpec(video.file) : null, [video]);


  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  useEffect(() => {
    const measuring = status === "analysis" || status === "conversion" || status === "finalizing";
    if (!measuring || workStartedAtRef.current === null) return;
    const updateElapsed = () => {
      if (workStartedAtRef.current !== null) {
        setElapsedSeconds(Math.floor((currentWorkTime() - workStartedAtRef.current) / 1000));
      }
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(timer);
  }, [status]);

  const resetLivePreview = () => {
    livePreviewReadyRef.current = false;
    lastPreviewAtRef.current = 0;
    setLivePreviewReady(false);
    const canvas = livePreviewRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const updateLivePreview = (source: HTMLCanvasElement, force = false, smooth = true) => {
    const canvas = livePreviewRef.current;
    if (!canvas) return;
    const renderedAt = drawLivePreviewFrame(source, canvas, lastPreviewAtRef.current, force, smooth);
    if (renderedAt === null) return;
    lastPreviewAtRef.current = renderedAt;
    if (!livePreviewReadyRef.current) {
      livePreviewReadyRef.current = true;
      setLivePreviewReady(true);
    }
  };

  const stopWorkTimer = () => {
    if (workStartedAtRef.current === null) return;
    setElapsedSeconds(Math.floor((currentWorkTime() - workStartedAtRef.current) / 1000));
    workStartedAtRef.current = null;
  };

  const clearResult = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrlRef.current = null;
    setResultUrl(null);
    setResultBlob(null);
    setResultPalette([]);
    resetLivePreview();
    setProgress(0);
    setElapsedSeconds(0);
    setHasWorkTime(false);
    workStartedAtRef.current = null;
    setStatus("idle");
    setMessage("");
  };

  const updateSettings = (updater: (draft: Settings) => void) => {
    setSettings((current) => {
      const next = cloneSettings(current);
      updater(next);
      return normalizeSlotCount(next);
    });
    clearResult();
  };

  const commitVideoNumber = (field: VideoNumericField, label: string, min: number, max: number) => {
    const currentValue = field === "paletteTendency"
      ? settings.paletteDiversity - 50
      : field === "surfaceCleanup"
        ? settings.surfaceCleanup
        : settings.adjustments[field];
    const value = Number(numericDrafts[field] ?? String(currentValue));
    setNumericDrafts((drafts) => { const next = { ...drafts }; delete next[field]; return next; });
    if (!Number.isInteger(value) || value < min || value > max) {
      setMessage(tr("{name} 값은 {min}~{max} 사이의 정수여야 합니다. 기존 값으로 되돌렸습니다.", { name: tr(label), min, max }));
      return;
    }
    if (value === currentValue) return;
    updateSettings((draft) => {
      if (field === "paletteTendency") draft.paletteDiversity = value + 50;
      else if (field === "surfaceCleanup") draft.surfaceCleanup = value;
      else draft.adjustments[field] = value;
    });
  };

  const updateVideoSlider = (field: VideoNumericField, value: number) => {
    setNumericDrafts((drafts) => { const next = { ...drafts }; delete next[field]; return next; });
    updateSettings((draft) => {
      if (field === "paletteTendency") draft.paletteDiversity = value + 50;
      else if (field === "surfaceCleanup") draft.surfaceCleanup = value;
      else draft.adjustments[field] = value;
    });
  };

  const applyVideoPreset = (preset: VideoPalettePreset) => {
    const colors = preset.colors.map((color) => hexToRgb(color) as RGB);
    setSettings((current) => applyPalettePreset(current, colors));
    setPresetOpen(false);
    clearResult();
    setMessage(tr("{name} 프리셋을 영상 팔레트에 적용했습니다.", { name: tr(preset.name) }));
  };

  const resetVideoAdjustments = () => {
    const defaults = defaultSettings();
    setNumericDrafts((drafts) => { const next = { ...drafts }; delete next.brightness; delete next.contrast; delete next.saturation; delete next.hue; return next; });
    updateSettings((draft) => {
      draft.adjustments = cloneSettings(defaults.adjustments);
      draft.pixelation = cloneSettings(defaults.pixelation);
    });
    setMessage(tr("색 보정과 픽셀화 설정을 초기화했습니다."));
  };

  const resetVideoPalette = () => {
    setNumericDrafts((drafts) => { const next = { ...drafts }; delete next.paletteTendency; return next; });
    setSettings((current) => resetPaletteSettings(current));
    setPresetOpen(false);
    clearResult();
    setMessage(tr("영상 팔레트의 고정 색상과 가중치를 초기화했습니다."));
  };

  const deleteVideoPaletteSlot = (index: number) => {
    if (busy || paletteMode === "frame") return;
    if (settings.colorCount <= 1) {
      setMessage(tr("팔레트에는 최소 한 가지 색상이 필요합니다."));
      return;
    }
    setSettings((current) => removePaletteSlot(current, index));
    clearResult();
    setMessage(tr("팔레트에서 {index}번 색상을 삭제했습니다.", { index: index + 1 }));
  };

  const inspectVideo = async (file: File) => {
    if (!isSupportedVideoFile(file)) throw new Error(tr("MP4와 WebM 영상만 지원합니다."));
    if (typeof VideoDecoder === "undefined" || typeof VideoEncoder === "undefined") {
      throw new Error(tr("이 브라우저는 영상 변환 기능을 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용해주세요."));
    }
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      if (!await input.canRead()) throw new Error(tr("영상 파일을 읽을 수 없습니다."));
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error(tr("영상 트랙이 없는 파일입니다."));
      if (!await track.canDecode()) throw new Error(tr("이 브라우저에서 영상 코덱을 디코딩할 수 없습니다."));
      const audio = await input.getPrimaryAudioTrack();
      const duration = await input.getDurationFromMetadata() ?? await input.computeDuration();
      const [width, height, hasAlpha] = await Promise.all([
        track.getDisplayWidth(),
        track.getDisplayHeight(),
        track.canBeTransparent(),
      ]);
      if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(duration) || width <= 0 || height <= 0 || duration <= 0) {
        throw new Error(tr("영상의 크기 또는 재생 시간을 확인할 수 없습니다."));
      }
      return {
        width,
        height,
        duration,
        videoCodec: String(await track.getCodec() ?? "unknown"),
        audioCodec: audio ? String(await audio.getCodec() ?? "unknown") : null,
        hasAlpha,
      };
    } finally {
      input.dispose();
    }
  };

  const loadVideo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLoadingFile(true);
    setMessage("");
    try {
      const info = await inspectVideo(file);
      if (video?.sourceUrl) URL.revokeObjectURL(video.sourceUrl);
      clearResult();
      const sourceUrl = URL.createObjectURL(file);
      sourceUrlRef.current = sourceUrl;
      setVideo({ file, sourceUrl, ...info });
      setMessage(tr("영상이 준비되었습니다. 설정을 확인한 뒤 변환을 실행하세요."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr("영상을 불러오지 못했습니다."));
      setStatus("error");
    } finally {
      setLoadingFile(false);
    }
  };

  const analyzeCommonPalette = async (input: Input, worker: Worker, duration: number, width: number, height: number) => {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(tr("영상 트랙이 없는 파일입니다."));
    const sampleWidth = Math.max(2, Math.min(240, width));
    const sampleHeight = Math.max(2, Math.round(height * sampleWidth / width));
    const timestamps = createAnalysisTimestamps(duration);
    const sink = new VideoSampleSink(track);
    const frames: Uint8ClampedArray[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error(tr("영상 분석용 캔버스를 만들 수 없습니다."));
    let index = 0;
    for await (const sample of sink.samplesAtTimestamps(timestamps)) {
      if (cancelRequested.current) { sample?.close(); throw new ConversionCanceledError(); }
      if (sample) {
        context.clearRect(0, 0, sampleWidth, sampleHeight);
        sample.draw(context, 0, 0, sampleWidth, sampleHeight);
        frames.push(new Uint8ClampedArray(context.getImageData(0, 0, sampleWidth, sampleHeight).data));
        sample.close();
      }
      index += 1;
      setProgress(stagedVideoProgress("analysis", index / timestamps.length));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    if (!frames.length) throw new Error(tr("영상에서 분석할 프레임을 찾지 못했습니다."));
    const pixels = new Uint8ClampedArray(sampleWidth * sampleHeight * 4 * frames.length);
    frames.forEach((frame, frameIndex) => pixels.set(frame, frameIndex * frame.length));
    return quantizeWithWorker(worker, pixels, sampleWidth, sampleHeight * frames.length, settings);
  };

  const convertVideo = async () => {
    if (!video || !outputSpec || busy) return;
    cancelRequested.current = false;
    clearResult();
    workStartedAtRef.current = currentWorkTime();
    setElapsedSeconds(0);
    setHasWorkTime(true);
    setStatus(paletteMode === "common" ? "analysis" : "conversion");
    setMessage(tr(paletteMode === "common" ? "영상 전체에서 공통 팔레트를 분석하고 있습니다." : "프레임별 팔레트로 영상을 변환하고 있습니다."));
    const worker = new QuantizeWorker();
    const input = new Input({ source: new BlobSource(video.file), formats: ALL_FORMATS });
    try {
      let conversionSettings = paletteMode === "frame" ? createFramePaletteSettings(settings) : cloneSettings(settings);
      if (paletteMode === "common") {
        const analyzed = await analyzeCommonPalette(input, worker, video.duration, video.width, video.height);
        conversionSettings = createCommonPaletteSettings(settings, analyzed.palette, analyzed.weights);
        setResultPalette(analyzed.palette);
      }
      if (cancelRequested.current) throw new ConversionCanceledError();
      setStatus("conversion");
      setProgress(stagedVideoProgress("conversion", 0, paletteMode === "common"));
      setMessage(tr("영상 프레임을 변환하고 있습니다."));
      const target = new BufferTarget();
      const format = outputSpec.format === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" });
      const output = new Output({ format, target });
      const outputDimensions = videoOutputDimensions(video.width, video.height, outputSpec.codec);
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = outputDimensions.width;
      frameCanvas.height = outputDimensions.height;
      const context = frameCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error(tr("영상 변환용 캔버스를 만들 수 없습니다."));
      const framePalettes = new Map<string, number>();
      const conversion = await Conversion.init({
        input,
        output,
        tracks: "primary",
        showWarnings: false,
        video: {
          codec: outputSpec.codec as VideoCodec,
          quality: QUALITY_HIGH,
          forceTranscode: true,
          allowRotationMetadata: false,
          alpha: video.hasAlpha && outputSpec.format === "webm" ? "keep" : "discard",
          processedWidth: outputDimensions.width,
          processedHeight: outputDimensions.height,
          process: async (sample) => {
            if (cancelRequested.current) throw new ConversionCanceledError();
            context.clearRect(0, 0, outputDimensions.width, outputDimensions.height);
            sample.draw(context, 0, 0, outputDimensions.width, outputDimensions.height);
            const source = new Uint8ClampedArray(context.getImageData(0, 0, outputDimensions.width, outputDimensions.height).data);
            const converted = await quantizeWithWorker(
              worker,
              source,
              outputDimensions.width,
              outputDimensions.height,
              conversionSettings,
              paletteMode === "frame",
            );
            context.putImageData(new ImageData(converted.result, outputDimensions.width, outputDimensions.height), 0, 0);
            updateLivePreview(frameCanvas, false, !conversionSettings.pixelation.enabled);
            if (paletteMode === "frame") {
              const frameColors = new Set(converted.palette.map((color) => rgbToHex(videoPaletteSummaryColor(color) as RGB)));
              frameColors.forEach((color) => framePalettes.set(color, (framePalettes.get(color) ?? 0) + 1));
            }
            return frameCanvas;
          },
        },
        audio: async (track) => {
          const codec = await track.getCodec();
          return codec ? { codec, forceTranscode: false } : undefined;
        },
      });
      conversionRef.current = conversion;
      const discardedAudio = conversion.discardedTracks.find(({ track }) => track.isAudioTrack());
      if (!conversion.isValid) throw new Error(tr("이 브라우저에서 선택한 영상 형식으로 인코딩할 수 없습니다."));
      if (video.audioCodec && discardedAudio) throw new Error(tr("원본 오디오를 그대로 유지할 수 없는 파일입니다."));
      conversion.onProgress = (value) => setProgress(stagedVideoProgress("conversion", value, paletteMode === "common"));
      await conversion.execute();
      updateLivePreview(frameCanvas, true, !conversionSettings.pixelation.enabled);
      setStatus("finalizing");
      setProgress(stagedVideoProgress("finalizing", 1));
      setMessage(tr("영상 파일을 마무리하고 있습니다."));
      if (!target.buffer) throw new Error(tr("변환된 영상 파일을 만들지 못했습니다."));
      const blob = new Blob([target.buffer], { type: outputSpec.mime });
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      if (paletteMode === "frame") {
        const popular = [...framePalettes.entries()].sort((a, b) => b[1] - a[1]).slice(0, settings.colorCount).map(([hex]) => hexToRgb(hex) as RGB);
        setResultPalette(popular);
      }
      setResultBlob(blob);
      setResultUrl(url);
      stopWorkTimer();
      setStatus("done");
      setProgress(stagedVideoProgress("done", 1));
      setMessage(tr(video.audioCodec ? "영상 변환이 완료되었습니다. 원본 오디오는 재압축하지 않고 유지했습니다." : "영상 변환이 완료되었습니다."));
    } catch (error) {
      stopWorkTimer();
      if (error instanceof ConversionCanceledError || cancelRequested.current) {
        setStatus("canceled");
        setMessage(tr("영상 변환을 취소했습니다."));
      } else {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : tr("영상 변환에 실패했습니다."));
      }
    } finally {
      conversionRef.current = null;
      worker.terminate();
      input.dispose();
    }
  };

  const cancel = async () => {
    cancelRequested.current = true;
    await conversionRef.current?.cancel();
  };

  const downloadResult = () => {
    if (!resultBlob || !outputSpec || !video) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(resultBlob);
    link.download = `${baseName(video.file.name)}-palette-forge.${outputSpec.extension}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const close = () => {
    if (busy) return;
    onClose();
  };

  if (!open) return null;
  return <div className="modal-backdrop video-modal-backdrop">
    <section className="video-dialog" role="dialog" aria-modal="true" aria-label={tr("영상 변환") }>
      <div className="dialog-head video-dialog-head">
        <div><span className="eyebrow">VIDEO CONVERTER</span><h2>{tr("영상 팔레트 변환")}</h2><p>{tr("영상은 서버로 전송되지 않고 이 브라우저에서 처리됩니다.")}</p></div>
        <button className="icon-button" disabled={busy} aria-label={tr("영상 변환 창 닫기")} onClick={close}>×</button>
      </div>

      <div className="video-dialog-body">
        <section className="video-source-card">
          <input ref={inputRef} hidden type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={loadVideo} />
          <button className="video-drop-button" disabled={busy || loadingFile} onClick={() => inputRef.current?.click()}>
            <strong>{loadingFile ? tr("영상을 확인하고 있습니다…") : video ? tr("다른 영상 선택") : tr("MP4 · WebM 영상 선택")}</strong>
            <small>{tr("한 번에 한 개의 영상을 처리합니다.")}</small>
          </button>
          {video && <div className="video-meta"><strong title={video.file.name}>{video.file.name}</strong><span>{video.width} × {video.height}</span><span>{secondsLabel(video.duration)}</span><span>{video.videoCodec}{video.audioCodec ? ` · ${video.audioCodec}` : ` · ${tr("오디오 없음")}`}</span></div>}
        </section>

        <div className="video-preview-grid">
          <figure><figcaption>{tr("원본 영상")}</figcaption>{video ? <><video src={video.sourceUrl} controls playsInline /></> : <div className="video-empty">{tr("영상을 선택해주세요.")}</div>}</figure>
          <figure><figcaption>{tr("변환 결과")}</figcaption>{resultUrl ? <video src={resultUrl} controls playsInline /> : busy ? <div className={`video-live-preview-shell ${livePreviewReady ? "is-ready" : ""}`}>
            <canvas ref={livePreviewRef} className="video-live-preview" role="img" aria-label={tr("변환 중인 마지막 프레임 미리보기")} />
            {!livePreviewReady && <div className="video-live-placeholder">{tr(status === "analysis" ? "팔레트 분석이 끝나면 변환 프레임이 표시됩니다." : "첫 번째 변환 프레임을 준비하고 있습니다.")}</div>}
            <span className="video-live-status">{tr(status === "analysis" ? "팔레트 분석 중" : status === "finalizing" ? "영상 마무리 중" : livePreviewReady ? "마지막 완료 프레임" : "프레임 변환 중")} · {progress}%{hasWorkTime && <> · {tr("작업 시간")} {formatVideoElapsedTime(elapsedSeconds)}</>}</span>
          </div> : <div className="video-empty">{tr("변환이 끝나면 결과를 확인할 수 있습니다.")}</div>}</figure>
        </div>

        <div className="video-settings-grid">
          <section className="video-setting-card">
            <h3>{tr("팔레트 생성 방식")}</h3>
            <label aria-label={tr("전체 영상 공통 팔레트")} className={`video-mode-option ${paletteMode === "common" ? "is-selected" : ""}`}><input type="radio" name="video-palette-mode" value="common" checked={paletteMode === "common"} disabled={busy} onChange={() => { setPaletteMode("common"); clearResult(); }} /><span><strong>{tr("전체 영상 공통 팔레트")}</strong><small>{tr("영상 전체를 분석해 같은 팔레트를 사용합니다. 색상 깜빡임이 적어 기본값으로 권장합니다.")}</small></span></label>
            <label aria-label={tr("프레임별 자동 팔레트")} className={`video-mode-option ${paletteMode === "frame" ? "is-selected" : ""}`}><input type="radio" name="video-palette-mode" value="frame" checked={paletteMode === "frame"} disabled={busy} onChange={() => { setPaletteMode("frame"); setPresetOpen(false); clearResult(); }} /><span><strong>{tr("프레임별 자동 팔레트")}</strong><small>{tr("각 프레임의 팔레트를 최근 프레임과 자연스럽게 연결하고, 장면 전환은 즉시 반영합니다.")}</small></span></label>
          </section>

          <section className="video-setting-card video-adjustments">
            <div className="video-setting-heading"><h3>{tr("색 보정")}</h3><button type="button" className="text-button" disabled={busy} onClick={resetVideoAdjustments}>{tr("초기화")}</button></div>
            {([ ["brightness", "밝기"], ["contrast", "대비"], ["saturation", "채도"], ["hue", "색조"] ] as const).map(([key, label]) => {
              const min = key === "hue" ? -180 : -100;
              const max = key === "hue" ? 180 : 100;
              return <label key={key}><span>{tr(label)}<input className="video-parameter-number compact-number-input" type="number" inputMode="numeric" min={min} max={max} step="1" aria-label={`${tr(label)} ${tr("숫자 직접 입력")}`} value={numericDrafts[key] ?? String(settings.adjustments[key])} disabled={busy} onChange={(event) => setNumericDrafts((drafts) => ({ ...drafts, [key]: event.target.value }))} onBlur={() => commitVideoNumber(key, label, min, max)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span><input type="range" min={min} max={max} value={settings.adjustments[key]} disabled={busy} onChange={(event) => updateVideoSlider(key, Number(event.target.value))} /></label>;
            })}
            <label className="video-pixel-toggle"><span>{tr("픽셀화")}</span><input type="checkbox" checked={settings.pixelation.enabled} disabled={busy} onChange={(event) => updateSettings((draft) => { draft.pixelation.enabled = event.target.checked; })} /></label>
            <label className="video-pixel-size"><span>{tr("블록 크기")}</span><input type="number" min="2" max="64" value={settings.pixelation.size} disabled={busy || !settings.pixelation.enabled} onChange={(event) => { const value = Number(event.target.value); if (value >= 2 && value <= 64) updateSettings((draft) => { draft.pixelation.size = value; }); }} /></label>
          </section>

          <section className="video-setting-card video-palette-settings">
            <div className="video-setting-heading"><h3>{tr("영상 팔레트")}</h3><div className="video-palette-heading-actions"><button type="button" className="text-button" disabled={busy || paletteMode === "frame"} aria-expanded={presetOpen} onClick={() => setPresetOpen((value) => !value)}>{tr("프리셋")}</button><button type="button" className="text-button" disabled={busy} onClick={resetVideoPalette}>{tr("초기화")}</button><label><span>{tr("색상 수")}</span><input type="number" min="1" max="32" value={settings.colorCount} disabled={busy} onChange={(event) => { const count = Number(event.target.value); if (count >= 1 && count <= 32) updateSettings((draft) => { draft.colorCount = count; }); }} /></label></div></div>
            {presetOpen && <div className="video-preset-panel" aria-label={tr("영상 팔레트 프리셋")}>
              {VIDEO_PALETTE_PRESETS.map((preset) => <button type="button" key={preset.id} onClick={() => applyVideoPreset(preset)}>
                <span aria-hidden="true">{preset.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                <strong>{tr(preset.name)}</strong><small>{tr("{name} · {count}색", { name: tr(preset.name), count: preset.colors.length })}</small>
              </button>)}
            </div>}            <label className="video-diversity"><span>{tr("자동 팔레트 성향")}<input className="video-parameter-number compact-number-input" type="number" inputMode="numeric" min="-50" max="50" step="1" aria-label={tr("자동 팔레트 성향 숫자")} value={numericDrafts.paletteTendency ?? String(settings.paletteDiversity - 50)} disabled={busy} onChange={(event) => setNumericDrafts((drafts) => ({ ...drafts, paletteTendency: event.target.value }))} onBlur={() => commitVideoNumber("paletteTendency", "자동 팔레트 성향", -50, 50)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span><input type="range" min="-50" max="50" value={settings.paletteDiversity - 50} disabled={busy} onChange={(event) => updateVideoSlider("paletteTendency", Number(event.target.value))} /><small><b>{tr("주조색 우선")}</b><b>{tr("원본 균형")}</b><b>{tr("색상 다양성")}</b></small></label>
            <label className="video-surface-cleanup"><span>{tr("면 정리 강도")}<input className="video-parameter-number compact-number-input" type="number" inputMode="numeric" min="0" max="100" step="1" aria-label={tr("면 정리 강도 숫자")} value={numericDrafts.surfaceCleanup ?? String(settings.surfaceCleanup)} disabled={busy} onChange={(event) => setNumericDrafts((drafts) => ({ ...drafts, surfaceCleanup: event.target.value }))} onBlur={() => commitVideoNumber("surfaceCleanup", "면 정리 강도", 0, 100)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span><input type="range" min="0" max="100" value={settings.surfaceCleanup} disabled={busy} onChange={(event) => updateVideoSlider("surfaceCleanup", Number(event.target.value))} /><small><b>{tr("디테일 유지")}</b><b>{tr("균형")}</b><b>{tr("깔끔한 면")}</b></small></label>
            {paletteMode === "frame" && <p className="video-frame-palette-note">{tr("프레임별 자동 팔레트에서는 아래 고정 색상과 가중치를 사용하지 않습니다.")}</p>}
            <div className={`video-slot-list ${paletteMode === "frame" ? "is-disabled" : ""}`}>{settings.slots.map((slot: { fixed: boolean; color: RGB | null; weight: number; weightMode: "auto" | "manual" }, index: number) => {
              const color = slot.color ?? [218, 218, 213] as RGB;
              const hex = rgbToHex(color);
              const mode = paletteSlotMode(slot);
              const modeLabel = mode === "auto" ? "자동" : mode === "color-fixed" ? "색 고정" : "고정";
              const modeAction = mode === "auto" ? "색상을 고정하고 가중치는 자동으로 유지" : mode === "color-fixed" ? "색상과 현재 가중치를 모두 고정" : "색상과 가중치를 모두 자동으로 전환";
              return <div className={`video-slot ${slot.fixed ? "is-fixed" : ""} ${mode === "fixed" ? "is-weight-fixed" : ""}`} key={index}>
                <label className="video-color-control"><input type="color" aria-label={tr("{index}번 팔레트 색상", { index: index + 1 })} value={hex} disabled={busy || paletteMode === "frame"} onChange={(event) => { const rgb = hexToRgb(event.target.value); if (rgb) setSettings((current) => fixPaletteSlot(current, index, rgb)); clearResult(); }} /><span className="video-slot-color"><strong>{hex}</strong><small>RGB {color.join(" · ")}</small></span></label>
                <button type="button" className="video-slot-mode slot-tag" title={tr(modeAction)} aria-label={tr(modeAction)} disabled={busy || paletteMode === "frame"} onClick={() => { setSettings((current) => cyclePaletteSlotMode(current, index, color)); clearResult(); }}>{tr(modeLabel)}</button>
                <input className="video-weight" type="number" min="0.1" max="5" step="0.1" aria-label={tr("{index}번 팔레트 가중치", { index: index + 1 })} value={slot.weight} disabled={busy || paletteMode === "frame" || (!slot.fixed && !slot.color)} title={!slot.fixed && !slot.color ? tr("먼저 색상을 고정한 뒤 가중치를 조절하세요.") : undefined} onChange={(event) => { const value = Number(event.target.value); if (value >= .1 && value <= 5) { setSettings((current) => fixPaletteSlotWeight(current, index, color, value)); clearResult(); } }} />
                <button type="button" className="video-delete-slot" disabled={busy || paletteMode === "frame" || settings.colorCount <= 1} title={tr("{index}번 팔레트 색상 삭제", { index: index + 1 })} aria-label={tr("{index}번 팔레트 색상 삭제", { index: index + 1 })} onClick={() => deleteVideoPaletteSlot(index)}>×</button>
              </div>;
            })}</div>
          </section>
        </div>

        {(busy || progress > 0 || message) && <section className={`video-progress-card ${status === "error" ? "is-error" : ""}`} aria-live="polite">
          <div><strong>{message || tr("영상 변환 준비")}</strong><span className="video-progress-meta">{hasWorkTime && <span>{tr("작업 시간")} <time>{formatVideoElapsedTime(elapsedSeconds)}</time></span>}<output>{progress}%</output></span></div>
          <progress max="100" value={progress}>{progress}%</progress>
          {busy && <small>{tr("브라우저에서 처리 중입니다. 이 탭을 닫지 마세요.")}</small>}
        </section>}
        {resultPalette.length > 0 && <section className="video-result-palette"><strong>{tr(paletteMode === "common" ? "적용된 공통 팔레트" : "프레임에서 자주 사용된 색상")}</strong><div>{resultPalette.map((color, index) => <span key={`${rgbToHex(color)}-${index}`} title={rgbToHex(color)} style={{ background: rgbToHex(color) }} />)}</div></section>}
      </div>

      <div className="video-dialog-actions">
        <span>{video?.audioCodec ? tr("원본 오디오 패킷 유지") : tr("오디오 없음")}</span>
        {busy ? <button className="button ghost" onClick={() => void cancel()}>{tr("변환 취소")}</button> : <button className="button ghost" onClick={close}>{tr("닫기")}</button>}
        <button className="button primary" disabled={!video || busy} onClick={() => void convertVideo()}>{resultBlob ? tr("다시 변환") : tr("영상 변환 실행")}</button>
        <button className="button primary" disabled={!resultBlob || busy} onClick={downloadResult}>{tr("변환 영상 저장")}</button>
      </div>
    </section>
  </div>;
}
