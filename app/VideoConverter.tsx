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
import { applyPalettePreset, cloneSettings, cyclePaletteSlotMode, defaultSettings, fixPaletteSlot, fixPaletteSlotWeight, hexToRgb, normalizeSlotCount, paletteSlotMode, removePaletteSlot, rgbToHex } from "../lib/palette.mjs";
import {
  createAnalysisTimestamps,
  createCommonPaletteSettings,
  createDefaultVideoSettings,
  createFramePaletteSettings,
  estimateVideoRemainingTime,
  estimateVideoWorkload,
  formatVideoElapsedTime,
  isSupportedVideoFile,
  smoothVideoRemainingTime,
  stagedVideoProgress,
  videoOutputDimensions,
  videoOutputSpec,
  videoPaletteSummaryColor,
} from "../lib/video.mjs";
import QuantizeWorker from "./quantize.worker?worker";
import { createGpuPaletteMapper, detectGpuCapability, pixelBuffersEqual, type GpuCapability, type GpuPaletteMapper } from "./gpu-palette";
import { Language, translate } from "./i18n";
import SectionHelp from "./SectionHelp";

type RGB = [number, number, number];
type Settings = ReturnType<typeof defaultSettings>;
type AdjustmentKey = keyof Settings["adjustments"];
type VideoNumericField = AdjustmentKey | "paletteTendency" | "surfaceCleanup";
type PaletteMode = "common" | "frame";
type AccelerationMode = "auto" | "cpu" | "gpu";
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

function runPaletteWorker(worker: Worker, operation: "prepare" | "map-fixed" | "quantize", pixels: Uint8ClampedArray, width: number, height: number, settings: Settings, temporalPaletteEnabled = false) {
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
    worker.postMessage({ operation, pixels: pixels.buffer, width, height, settings, temporalPaletteEnabled }, [pixels.buffer]);
  });
}

function quantizeWithWorker(worker: Worker, pixels: Uint8ClampedArray, width: number, height: number, settings: Settings, temporalPaletteEnabled = false) {
  return runPaletteWorker(worker, "quantize", pixels, width, height, settings, temporalPaletteEnabled);
}

async function prepareWithWorker(worker: Worker, pixels: Uint8ClampedArray, width: number, height: number, settings: Settings) {
  return (await runPaletteWorker(worker, "prepare", pixels, width, height, settings)).result;
}

function mapFixedWithWorker(worker: Worker, pixels: Uint8ClampedArray, width: number, height: number, settings: Settings) {
  return runPaletteWorker(worker, "map-fixed", pixels, width, height, settings);
}

function secondsLabel(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "") || "palette-forge-video";
}

function fileSizeLabel(bytes: number) {
  const megabytes = Math.max(0, bytes) / (1024 * 1024);
  return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(1)} GB` : `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
}

function browserDeviceMemory() {
  if (typeof navigator === "undefined") return null;
  const value = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
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
  onClose,
}: {
  open: boolean;
  language: Language;
  onClose: () => void;
}) {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [settings, setSettings] = useState<Settings>(() => createDefaultVideoSettings());
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("common");
  const [accelerationMode, setAccelerationMode] = useState<AccelerationMode>("auto");
  const [gpuCapability, setGpuCapability] = useState<GpuCapability>({ available: false, label: "GPU 확인 중" });
  const [gpuChecking, setGpuChecking] = useState(true);
  const [accelerationNotice, setAccelerationNotice] = useState("");
  const [activeAcceleration, setActiveAcceleration] = useState<"cpu" | "gpu" | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "analysis" | "conversion" | "finalizing" | "done" | "error" | "canceled">("idle");
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedRemainingSeconds, setEstimatedRemainingSeconds] = useState<number | null>(null);
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
  const phaseStartedAtRef = useRef<number | null>(null);
  const phaseProgressRef = useRef(0);
  const phaseProgressSamplesRef = useRef<Array<{ time: number; progress: number }>>([]);
  const smoothedRemainingRef = useRef<number | null>(null);
  const cancelRequested = useRef(false);
  const tr = (source: string, values: Record<string, string | number> = {}) => translate(language, source, values);
  const busy = loadingFile || status === "analysis" || status === "conversion" || status === "finalizing";
  const outputSpec = useMemo(() => video ? videoOutputSpec(video.file) : null, [video]);
  const workload = useMemo(() => video ? estimateVideoWorkload({
    width: video.width,
    height: video.height,
    duration: video.duration,
    fileSize: video.file.size,
    deviceMemory: browserDeviceMemory(),
  }) : null, [video]);
  const gpuEligible = paletteMode === "common" && settings.surfaceCleanup === 0;
  const measuring = status === "analysis" || status === "conversion" || status === "finalizing";
  const remainingTimeLabel = status === "finalizing"
    ? tr("파일 마무리 중")
    : estimatedRemainingSeconds === null
      ? tr("예상 시간 계산 중")
      : tr("약 {time} 남음", { time: formatVideoElapsedTime(estimatedRemainingSeconds) });
  const remainingTimeValue = status === "finalizing"
    ? tr("마무리 중")
    : estimatedRemainingSeconds === null
      ? tr("계산 중")
      : formatVideoElapsedTime(estimatedRemainingSeconds);

  const startProgressPhase = (startedAt = currentWorkTime()) => {
    phaseStartedAtRef.current = startedAt;
    phaseProgressRef.current = 0;
    phaseProgressSamplesRef.current = [{ time: startedAt, progress: 0 }];
    smoothedRemainingRef.current = null;
    setProgress(0);
    setEstimatedRemainingSeconds(null);
  };

  const updatePhaseProgress = (value: number) => {
    phaseProgressRef.current = value;
    setProgress(Math.round(value));
  };


  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void detectGpuCapability().then((capability) => {
      if (!active) return;
      setGpuCapability(capability);
      setGpuChecking(false);
    });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!measuring || workStartedAtRef.current === null) return;
    const updateElapsed = () => {
      const now = currentWorkTime();
      if (workStartedAtRef.current !== null) {
        setElapsedSeconds(Math.floor((now - workStartedAtRef.current) / 1000));
      }
      if (phaseStartedAtRef.current !== null) {
        const samples = phaseProgressSamplesRef.current;
        const lastSample = samples.at(-1);
        if (!lastSample || now - lastSample.time >= 1_000) samples.push({ time: now, progress: phaseProgressRef.current });
        phaseProgressSamplesRef.current = samples.length > 1_800 ? [samples[0], ...samples.slice(-1_799)] : samples;
        const rawRemaining = estimateVideoRemainingTime(samples, phaseProgressRef.current);
        const smoothed = smoothVideoRemainingTime(smoothedRemainingRef.current, rawRemaining);
        if (smoothed !== null) {
          smoothedRemainingRef.current = smoothed;
          setEstimatedRemainingSeconds(Math.round(smoothed));
        }
      }
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(timer);
  }, [measuring]);

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
    const now = currentWorkTime();
    setElapsedSeconds(Math.floor((now - workStartedAtRef.current) / 1000));
    workStartedAtRef.current = null;
    phaseStartedAtRef.current = null;
    setEstimatedRemainingSeconds(null);
  };

  const clearResult = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrlRef.current = null;
    setResultUrl(null);
    setResultBlob(null);
    setResultPalette([]);
    resetLivePreview();
    phaseProgressRef.current = 0;
    phaseProgressSamplesRef.current = [];
    smoothedRemainingRef.current = null;
    setProgress(0);
    setElapsedSeconds(0);
    setEstimatedRemainingSeconds(null);
    setHasWorkTime(false);
    workStartedAtRef.current = null;
    setStatus("idle");
    setMessage("");
    setAccelerationNotice("");
    setActiveAcceleration(null);
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
    const defaults = createDefaultVideoSettings();
    setNumericDrafts((drafts) => {
      const next = { ...drafts };
      delete next.paletteTendency;
      delete next.surfaceCleanup;
      return next;
    });
    setSettings((current) => normalizeSlotCount({
      ...cloneSettings(current),
      colorCount: defaults.colorCount,
      slots: defaults.slots,
      paletteDiversity: defaults.paletteDiversity,
      surfaceCleanup: defaults.surfaceCleanup,
    }));
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
        frames.push(context.getImageData(0, 0, sampleWidth, sampleHeight).data);
        sample.close();
      }
      index += 1;
      updatePhaseProgress(stagedVideoProgress("analysis", index / timestamps.length));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    if (!frames.length) throw new Error(tr("영상에서 분석할 프레임을 찾지 못했습니다."));
    const pixels = new Uint8ClampedArray(sampleWidth * sampleHeight * 4 * frames.length);
    frames.forEach((frame, frameIndex) => pixels.set(frame, frameIndex * frame.length));
    return quantizeWithWorker(worker, pixels, sampleWidth, sampleHeight * frames.length, settings);
  };

  const convertVideo = async () => {
    if (!video || !outputSpec || busy) return;
    if (workload?.level === "risk" && !window.confirm(tr("이 영상은 브라우저 메모리 부담이 매우 클 것으로 예상됩니다. 탭이 중단될 수 있습니다. 그래도 변환할까요?"))) return;
    cancelRequested.current = false;
    clearResult();
    const startedAt = currentWorkTime();
    workStartedAtRef.current = startedAt;
    startProgressPhase(startedAt);
    setElapsedSeconds(0);
    setHasWorkTime(true);
    setStatus(paletteMode === "common" ? "analysis" : "conversion");
    setMessage(tr(paletteMode === "common" ? "영상 전체에서 공통 팔레트를 분석하고 있습니다." : "프레임별 팔레트로 영상을 변환하고 있습니다."));
    const worker = new QuantizeWorker();
    const input = new Input({ source: new BlobSource(video.file), formats: ALL_FORMATS });
    let gpuMapper: GpuPaletteMapper | null = null;
    let resolvedAcceleration: "cpu" | "gpu" | "benchmark" = "cpu";
    try {
      let conversionSettings = paletteMode === "frame" ? createFramePaletteSettings(settings) : cloneSettings(settings);
      if (paletteMode === "common") {
        const analyzed = await analyzeCommonPalette(input, worker, video.duration, video.width, video.height);
        conversionSettings = createCommonPaletteSettings(settings, analyzed.palette, analyzed.weights);
        setResultPalette(analyzed.palette);
        if (accelerationMode !== "cpu" && gpuEligible && gpuCapability.available) {
          try {
            gpuMapper = await createGpuPaletteMapper(analyzed.palette, analyzed.weights);
            resolvedAcceleration = "benchmark";
            setAccelerationNotice(tr("CPU와 GPU의 속도와 결과를 비교하고 있습니다."));
          } catch (error) {
            setActiveAcceleration("cpu");
            setAccelerationNotice(tr("GPU를 시작하지 못해 CPU로 자동 전환했습니다. {reason}", { reason: error instanceof Error ? error.message : tr("알 수 없는 오류") }));
          }
        } else {
          setActiveAcceleration("cpu");
          setAccelerationNotice(accelerationMode === "cpu"
            ? tr("CPU 처리로 변환합니다.")
            : !gpuEligible
              ? tr("현재 설정은 GPU 가속 대상이 아니므로 CPU로 변환합니다.")
              : tr("이 브라우저에서 GPU를 사용할 수 없어 CPU로 자동 전환했습니다."));
        }
      } else {
        setActiveAcceleration("cpu");
        setAccelerationNotice(tr("프레임별 자동 팔레트는 CPU로 변환합니다."));
      }
      if (cancelRequested.current) throw new ConversionCanceledError();
      startProgressPhase();
      setStatus("conversion");
      updatePhaseProgress(stagedVideoProgress("conversion", 0));
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
            const source = context.getImageData(0, 0, outputDimensions.width, outputDimensions.height).data;
            let converted: WorkerResult;
            if (paletteMode === "common" && gpuMapper && resolvedAcceleration === "benchmark") {
              const cpuSource = source.slice();
              const cpuStartedAt = performance.now();
              const cpuResult = await quantizeWithWorker(worker, cpuSource, outputDimensions.width, outputDimensions.height, conversionSettings);
              const cpuDuration = performance.now() - cpuStartedAt;
              try {
                const gpuStartedAt = performance.now();
                const prepared = await prepareWithWorker(worker, source, outputDimensions.width, outputDimensions.height, conversionSettings);
                const gpuResult = await gpuMapper.map(prepared);
                const gpuDuration = performance.now() - gpuStartedAt;
                if (!pixelBuffersEqual(cpuResult.result, gpuResult)) {
                  gpuMapper.dispose();
                  gpuMapper = null;
                  resolvedAcceleration = "cpu";
                  setActiveAcceleration("cpu");
                  setAccelerationNotice(tr("GPU 결과가 CPU와 일치하지 않아 CPU로 자동 전환했습니다."));
                  converted = cpuResult;
                } else if (accelerationMode === "auto" && gpuDuration >= cpuDuration * .8) {
                  const gpuLabel = gpuMapper.label;
                  gpuMapper.dispose();
                  gpuMapper = null;
                  resolvedAcceleration = "cpu";
                  setActiveAcceleration("cpu");
                  setAccelerationNotice(tr("속도 측정 결과 CPU가 더 적합해 CPU로 변환합니다. GPU: {gpu}", { gpu: gpuLabel }));
                  converted = cpuResult;
                } else {
                  resolvedAcceleration = "gpu";
                  setActiveAcceleration("gpu");
                  setAccelerationNotice(tr("GPU 가속 사용 중: {gpu}", { gpu: gpuMapper.label }));
                  converted = { ...cpuResult, result: gpuResult };
                }
              } catch (error) {
                gpuMapper?.dispose();
                gpuMapper = null;
                resolvedAcceleration = "cpu";
                setActiveAcceleration("cpu");
                setAccelerationNotice(tr("GPU 처리 중 문제가 발생해 CPU로 자동 전환했습니다. {reason}", { reason: error instanceof Error ? error.message : tr("알 수 없는 오류") }));
                converted = cpuResult;
              }
            } else if (paletteMode === "common" && gpuMapper && resolvedAcceleration === "gpu") {
              const prepared = await prepareWithWorker(worker, source, outputDimensions.width, outputDimensions.height, conversionSettings);
              try {
                const gpuResult = await gpuMapper.map(prepared);
                converted = { result: gpuResult, palette: [], weights: [], sceneCut: false, difference: 0, frameDifference: 0, sceneScore: 0 };
              } catch (error) {
                gpuMapper.dispose();
                gpuMapper = null;
                resolvedAcceleration = "cpu";
                setActiveAcceleration("cpu");
                setAccelerationNotice(tr("GPU 처리 중 문제가 발생해 CPU로 자동 전환했습니다. 이후 프레임은 CPU로 처리합니다. {reason}", { reason: error instanceof Error ? error.message : tr("알 수 없는 오류") }));
                converted = await mapFixedWithWorker(worker, prepared, outputDimensions.width, outputDimensions.height, conversionSettings);
              }
            } else {
              converted = await quantizeWithWorker(
                worker,
                source,
                outputDimensions.width,
                outputDimensions.height,
                conversionSettings,
                paletteMode === "frame",
              );
            }
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
      conversion.onProgress = (value) => updatePhaseProgress(stagedVideoProgress("conversion", value));
      await conversion.execute();
      updateLivePreview(frameCanvas, true, !conversionSettings.pixelation.enabled);
      setStatus("finalizing");
      updatePhaseProgress(stagedVideoProgress("finalizing", 1));
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
      updatePhaseProgress(stagedVideoProgress("done", 1));
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
      gpuMapper?.dispose();
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
          {video && <div className="video-source-info">
            <div className="video-meta"><strong title={video.file.name}>{video.file.name}</strong><span>{fileSizeLabel(video.file.size)}</span><span>{video.width} × {video.height}</span><span>{secondsLabel(video.duration)}</span><span>{video.videoCodec}{video.audioCodec ? ` · ${video.audioCodec}` : ` · ${tr("오디오 없음")}`}</span></div>
            {workload && <div className={`video-workload is-${workload.level}`}>
              <div><span>{tr("예상 처리 부담")}</span><strong>{tr(workload.level === "smooth" ? "원활" : workload.level === "caution" ? "주의" : "위험")}</strong></div>
              <p>{tr(workload.level === "smooth" ? "현재 영상 정보 기준으로 비교적 원활한 처리가 예상됩니다." : workload.level === "caution" ? "처리가 오래 걸리거나 메모리 사용량이 커질 수 있습니다. 다른 탭을 닫는 것을 권장합니다." : "브라우저 탭이 중단될 가능성이 있습니다. 영상을 짧게 자르거나 해상도를 낮추는 것을 권장합니다.")}</p>
              <small>{workload.factors.length > 0 && <b>{workload.factors.map((factor) => tr(factor)).join(" · ")} · </b>}{tr("브라우저가 제공하는 정보로 계산한 추정치이며 실제 여유 메모리와 다를 수 있습니다.")}</small>
            </div>}
          </div>}
        </section>

        <div className="video-preview-grid">
          <figure><figcaption>{tr("원본 영상")}</figcaption>{video ? <><video src={video.sourceUrl} controls playsInline /></> : <div className="video-empty">{tr("영상을 선택해주세요.")}</div>}</figure>
          <figure><figcaption>{tr("변환 결과")}</figcaption>{resultUrl ? <video src={resultUrl} controls playsInline /> : busy ? <div className={`video-live-preview-shell ${livePreviewReady ? "is-ready" : ""}`}>
            <canvas ref={livePreviewRef} className="video-live-preview" role="img" aria-label={tr("변환 중인 마지막 프레임 미리보기")} />
            {!livePreviewReady && <div className="video-live-placeholder">{tr(status === "analysis" ? "팔레트 분석이 끝나면 변환 프레임이 표시됩니다." : "첫 번째 변환 프레임을 준비하고 있습니다.")}</div>}
            <span className="video-live-status">{tr(status === "analysis" ? "팔레트 분석 중" : status === "finalizing" ? "영상 마무리 중" : livePreviewReady ? "마지막 완료 프레임" : "프레임 변환 중")} · {progress}%{hasWorkTime && <> · {tr("경과 시간")} {formatVideoElapsedTime(elapsedSeconds)}</>}{measuring && <> · {remainingTimeLabel}</>}</span>
          </div> : <div className="video-empty">{tr("변환이 끝나면 결과를 확인할 수 있습니다.")}</div>}</figure>
        </div>

        <div className="video-settings-grid">
          <section className="video-setting-card">
            <div className="video-setting-heading"><div className="video-section-title"><h3>{tr("팔레트 생성 방식")}</h3><SectionHelp label={tr("팔레트 생성 방식 도움말 열기")} title={tr("영상 팔레트 생성 방식")} summary={tr("영상 전체 구간에서 공통 팔레트를 만들지, 프레임마다 자동으로 조정할지 선택할 수 있습니다.")}><ul><li><strong>{tr("전체 영상 공통 팔레트")}</strong>{tr("영상 전체 구간의 대표 장면을 분석해 같은 팔레트를 끝까지 사용합니다. 색상 깜빡임이 적어 처음 사용할 때 권장합니다.")}</li><li><strong>{tr("프레임별 자동 팔레트")}</strong>{tr("각 프레임에 맞는 팔레트를 만들고 최근 프레임과 자연스럽게 연결합니다. 장면 전환은 빠르게 반영하지만 일부 영상에서는 색 변화가 보일 수 있습니다.")}</li></ul></SectionHelp></div></div>
            <label aria-label={tr("전체 영상 공통 팔레트")} className={`video-mode-option ${paletteMode === "common" ? "is-selected" : ""}`}><input type="radio" name="video-palette-mode" value="common" checked={paletteMode === "common"} disabled={busy} onChange={() => { setPaletteMode("common"); clearResult(); }} /><span><strong>{tr("전체 영상 공통 팔레트")}</strong><small>{tr("영상 전체를 분석해 같은 팔레트를 사용합니다. 색상 깜빡임이 적어 기본값으로 권장합니다.")}</small></span></label>
            <label aria-label={tr("프레임별 자동 팔레트")} className={`video-mode-option ${paletteMode === "frame" ? "is-selected" : ""}`}><input type="radio" name="video-palette-mode" value="frame" checked={paletteMode === "frame"} disabled={busy} onChange={() => { setPaletteMode("frame"); setPresetOpen(false); clearResult(); }} /><span><strong>{tr("프레임별 자동 팔레트")}</strong><small>{tr("각 프레임의 팔레트를 최근 프레임과 자연스럽게 연결하고, 장면 전환은 즉시 반영합니다.")}</small></span></label>
            <div className="video-acceleration">
              <label><span>{tr("처리 가속")}</span><select value={accelerationMode} disabled={busy || gpuChecking} onChange={(event) => { setAccelerationMode(event.target.value as AccelerationMode); clearResult(); }}><option value="auto">{tr("자동 권장")}</option><option value="cpu">CPU</option><option value="gpu" disabled={!gpuCapability.available || !gpuEligible}>{tr("실험적 GPU")}</option></select></label>
              <div className="video-gpu-info"><span className={`video-acceleration-dot ${activeAcceleration ? `is-${activeAcceleration}` : ""}`} aria-hidden="true" /><span>{gpuChecking ? tr("GPU 확인 중") : gpuCapability.available ? tr(gpuCapability.label) : tr("GPU를 사용할 수 없음")}</span></div>
              {!gpuEligible && <small>{tr("GPU는 전체 공통 팔레트와 면 정리 0에서만 사용할 수 있습니다.")}</small>}
              {accelerationNotice && <p className={`video-acceleration-notice ${activeAcceleration === "cpu" && accelerationMode !== "cpu" ? "is-fallback" : ""}`} aria-live="polite">{accelerationNotice}</p>}
            </div>
          </section>

          <section className="video-setting-card video-adjustments">
            <div className="video-setting-heading"><div className="video-section-title"><h3>{tr("색 보정")}</h3><SectionHelp label={tr("영상 색 보정 도움말 열기")} title={tr("색 보정")} summary={tr("영상의 모든 프레임에 같은 색 보정과 픽셀화를 적용할 수 있습니다.")}><ul><li><strong>{tr("밝기·대비")}</strong>{tr("영상 전체의 밝기와 밝고 어두운 부분의 차이를 조절합니다.")}</li><li><strong>{tr("채도·색조")}</strong>{tr("색의 선명함과 영상 전체의 색 계열을 바꿉니다.")}</li><li><strong>{tr("픽셀화")}</strong>{tr("픽셀화를 켜면 영상을 사각형 블록으로 표현하며, 블록 크기가 클수록 픽셀이 굵어집니다.")}</li></ul></SectionHelp></div><button type="button" className="text-button" disabled={busy} onClick={resetVideoAdjustments}>{tr("초기화")}</button></div>
            {([ ["brightness", "밝기"], ["contrast", "대비"], ["saturation", "채도"], ["hue", "색조"] ] as const).map(([key, label]) => {
              const min = key === "hue" ? -180 : -100;
              const max = key === "hue" ? 180 : 100;
              return <label key={key}><span>{tr(label)}<input className="video-parameter-number compact-number-input" type="number" inputMode="numeric" min={min} max={max} step="1" aria-label={`${tr(label)} ${tr("숫자 직접 입력")}`} value={numericDrafts[key] ?? String(settings.adjustments[key])} disabled={busy} onChange={(event) => setNumericDrafts((drafts) => ({ ...drafts, [key]: event.target.value }))} onBlur={() => commitVideoNumber(key, label, min, max)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span><input type="range" min={min} max={max} value={settings.adjustments[key]} disabled={busy} onChange={(event) => updateVideoSlider(key, Number(event.target.value))} /></label>;
            })}
            <label className="video-pixel-toggle"><span>{tr("픽셀화")}</span><input type="checkbox" checked={settings.pixelation.enabled} disabled={busy} onChange={(event) => updateSettings((draft) => { draft.pixelation.enabled = event.target.checked; })} /></label>
            <label className="video-pixel-size"><span>{tr("블록 크기")}</span><input type="number" min="2" max="64" value={settings.pixelation.size} disabled={busy || !settings.pixelation.enabled} onChange={(event) => { const value = Number(event.target.value); if (value >= 2 && value <= 64) updateSettings((draft) => { draft.pixelation.size = value; }); }} /></label>
          </section>

          <section className="video-setting-card video-palette-settings">
            <div className="video-setting-heading"><div className="video-section-title"><h3>{tr("영상 팔레트")}</h3><SectionHelp label={tr("영상 팔레트 도움말 열기")} title={tr("영상 팔레트")} summary={tr("변환된 영상에 사용할 색상 수와 팔레트 설정을 정할 수 있습니다.")}><ul><li><strong>{tr("공통 팔레트일 때")}</strong>{tr("프리셋, 고정 색상과 가중치가 영상의 모든 프레임에 적용됩니다.")}</li><li><strong>{tr("프레임별 팔레트일 때")}</strong>{tr("고정 색상과 가중치는 사용하지 않지만 색상 수, 팔레트 성향과 면 정리는 계속 적용됩니다.")}</li><li><strong>{tr("자동 팔레트 성향")}</strong>{tr("왼쪽은 많이 쓰인 주조색을 우선하고, 가운데는 원본 균형을 유지하며, 오른쪽은 서로 다른 색을 다양하게 선택합니다.")}</li><li><strong>{tr("면 정리 강도")}</strong>{tr("낮추면 작은 색 디테일을 유지하고, 높이면 자잘한 색 얼룩을 줄여 넓은 면을 깔끔하게 만듭니다.")}</li></ul></SectionHelp></div><div className="video-palette-heading-actions"><button type="button" className="text-button" disabled={busy || paletteMode === "frame"} aria-expanded={presetOpen} onClick={() => setPresetOpen((value) => !value)}>{tr("프리셋")}</button><button type="button" className="text-button" disabled={busy} onClick={resetVideoPalette}>{tr("초기화")}</button><label><span>{tr("색상 수")}</span><input type="number" min="1" max="32" value={settings.colorCount} disabled={busy} onChange={(event) => { const count = Number(event.target.value); if (count >= 1 && count <= 32) updateSettings((draft) => { draft.colorCount = count; }); }} /></label></div></div>
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
          <div><strong>{message || tr("영상 변환 준비")}</strong><span className="video-progress-meta">{hasWorkTime && <span>{tr("경과 시간")} <time>{formatVideoElapsedTime(elapsedSeconds)}</time></span>}{measuring && <span>{tr("남은 예상 시간")} <strong className="video-progress-value">{remainingTimeValue}</strong></span>}<output>{progress}%</output></span></div>
          <progress max="100" value={progress}>{progress}%</progress>
          {busy && <small>{tr("브라우저에서 처리 중입니다. 이 탭을 닫지 마세요.")}</small>}
          {accelerationNotice && <small className={`video-progress-acceleration ${activeAcceleration === "cpu" && accelerationMode !== "cpu" ? "is-fallback" : ""}`}>{accelerationNotice}</small>}
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
