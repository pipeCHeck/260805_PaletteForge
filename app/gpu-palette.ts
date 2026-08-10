import { rgbToOklab } from "../lib/palette.mjs";

/* WebGPU DOM types are not included by every TypeScript target used by this project. */
/* eslint-disable @typescript-eslint/no-explicit-any */

type RGB = [number, number, number];

export type GpuCapability = {
  available: boolean;
  label: string;
  reason?: string;
};

export type GpuPaletteMapper = {
  label: string;
  map(pixels: Uint8ClampedArray): Promise<Uint8ClampedArray>;
  dispose(): void;
};

type NavigatorWithGpu = Navigator & { gpu?: { requestAdapter(options?: unknown): Promise<any> } };

function adapterLabel(adapter: any) {
  const info = adapter?.info;
  const parts = [info?.description, info?.vendor, info?.architecture, info?.device]
    .filter((value, index, values) => typeof value === "string" && value.trim() && values.indexOf(value) === index);
  return parts.length ? parts.join(" · ") : "브라우저가 선택한 GPU";
}

async function requestGpuAdapter() {
  if (typeof navigator === "undefined") return null;
  const gpu = (navigator as NavigatorWithGpu).gpu;
  if (!gpu) return null;
  return gpu.requestAdapter({ powerPreference: "high-performance" });
}

export async function detectGpuCapability(): Promise<GpuCapability> {
  try {
    const adapter = await requestGpuAdapter();
    return adapter
      ? { available: true, label: adapterLabel(adapter) }
      : { available: false, label: "GPU를 사용할 수 없음", reason: "WebGPU 어댑터를 찾지 못했습니다." };
  } catch (error) {
    return {
      available: false,
      label: "GPU를 사용할 수 없음",
      reason: error instanceof Error ? error.message : "WebGPU 초기화에 실패했습니다.",
    };
  }
}

const SHADER = /* wgsl */ `
struct Params {
  pixelCount: u32,
  paletteCount: u32,
  unusedA: u32,
  unusedB: u32,
}

@group(0) @binding(0) var<storage, read> sourcePixels: array<u32>;
@group(0) @binding(1) var<storage, read_write> resultPixels: array<u32>;
@group(0) @binding(2) var<storage, read> paletteLabs: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> paletteColors: array<u32>;
@group(0) @binding(4) var<uniform> params: Params;

fn linearChannel(channel: f32) -> f32 {
  let value = channel / 255.0;
  if (value <= 0.04045) { return value / 12.92; }
  return pow((value + 0.055) / 1.055, 2.4);
}

fn toOklab(red: f32, green: f32, blue: f32) -> vec3<f32> {
  let r = linearChannel(red);
  let g = linearChannel(green);
  let b = linearChannel(blue);
  let l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  let m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  let s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  let l3 = pow(max(l, 0.0), 0.3333333333);
  let m3 = pow(max(m, 0.0), 0.3333333333);
  let s3 = pow(max(s, 0.0), 0.3333333333);
  return vec3<f32>(
    0.2104542553 * l3 + 0.7936177850 * m3 - 0.0040720468 * s3,
    1.9779984951 * l3 - 2.4285922050 * m3 + 0.4505937099 * s3,
    0.0259040371 * l3 + 0.7827717662 * m3 - 0.8086757660 * s3
  );
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= params.pixelCount) { return; }
  let packed = sourcePixels[index];
  let alpha = (packed >> 24u) & 255u;
  if (alpha == 0u) {
    resultPixels[index] = packed;
    return;
  }
  let red = f32(packed & 255u);
  let green = f32((packed >> 8u) & 255u);
  let blue = f32((packed >> 16u) & 255u);
  let lab = toOklab(red, green, blue);
  var bestIndex = 0u;
  var bestDistance = 3.402823466e+38;
  for (var paletteIndex = 0u; paletteIndex < params.paletteCount; paletteIndex += 1u) {
    let candidate = paletteLabs[paletteIndex];
    let delta = lab - candidate.xyz;
    let distance = dot(delta, delta) * candidate.w;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = paletteIndex;
    }
  }
  resultPixels[index] = (paletteColors[bestIndex] & 0x00ffffffu) | (alpha << 24u);
}
`;

export async function createGpuPaletteMapper(palette: RGB[], weights: number[]): Promise<GpuPaletteMapper> {
  const adapter = await requestGpuAdapter();
  if (!adapter) throw new Error("WebGPU 어댑터를 찾지 못했습니다.");
  const device = await adapter.requestDevice();
  const usage = (globalThis as any).GPUBufferUsage;
  const mapMode = (globalThis as any).GPUMapMode;
  if (!usage || !mapMode) throw new Error("WebGPU 버퍼 기능을 사용할 수 없습니다.");

  let disposed = false;
  let lostReason = "";
  device.lost.then((info: any) => { lostReason = info?.message || "GPU 장치 연결이 끊어졌습니다."; }).catch(() => {});

  const shader = device.createShaderModule({ code: SHADER });
  const pipeline = device.createComputePipeline({ layout: "auto", compute: { module: shader, entryPoint: "main" } });
  const paletteLabData = new Float32Array(palette.length * 4);
  const paletteColorData = new Uint32Array(palette.length);
  palette.forEach((color, index) => {
    const lab = rgbToOklab(color);
    paletteLabData.set([lab[0], lab[1], lab[2], 1 / Math.max(0.1, weights[index] ?? 1)], index * 4);
    paletteColorData[index] = color[0] | (color[1] << 8) | (color[2] << 16) | (255 << 24);
  });
  const paletteLabBuffer = device.createBuffer({ size: paletteLabData.byteLength, usage: usage.STORAGE | usage.COPY_DST });
  const paletteColorBuffer = device.createBuffer({ size: paletteColorData.byteLength, usage: usage.STORAGE | usage.COPY_DST });
  const paramsBuffer = device.createBuffer({ size: 16, usage: usage.UNIFORM | usage.COPY_DST });
  device.queue.writeBuffer(paletteLabBuffer, 0, paletteLabData);
  device.queue.writeBuffer(paletteColorBuffer, 0, paletteColorData);

  let capacity = 0;
  let sourceBuffer: any = null;
  let resultBuffer: any = null;
  let readbackBuffer: any = null;
  let bindGroup: any = null;

  const destroyFrameBuffers = () => {
    sourceBuffer?.destroy();
    resultBuffer?.destroy();
    readbackBuffer?.destroy();
    sourceBuffer = null;
    resultBuffer = null;
    readbackBuffer = null;
    bindGroup = null;
    capacity = 0;
  };

  const ensureCapacity = (byteLength: number) => {
    if (capacity >= byteLength && bindGroup) return;
    destroyFrameBuffers();
    capacity = Math.ceil(byteLength / 256) * 256;
    sourceBuffer = device.createBuffer({ size: capacity, usage: usage.STORAGE | usage.COPY_DST });
    resultBuffer = device.createBuffer({ size: capacity, usage: usage.STORAGE | usage.COPY_SRC });
    readbackBuffer = device.createBuffer({ size: capacity, usage: usage.COPY_DST | usage.MAP_READ });
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: sourceBuffer } },
        { binding: 1, resource: { buffer: resultBuffer } },
        { binding: 2, resource: { buffer: paletteLabBuffer } },
        { binding: 3, resource: { buffer: paletteColorBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } },
      ],
    });
  };

  return {
    label: adapterLabel(adapter),
    async map(pixels) {
      if (disposed) throw new Error("GPU 변환기가 이미 종료되었습니다.");
      if (lostReason) throw new Error(lostReason);
      if (!pixels.byteLength) return new Uint8ClampedArray();
      ensureCapacity(pixels.byteLength);
      device.queue.writeBuffer(sourceBuffer, 0, pixels);
      device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([pixels.length / 4, palette.length, 0, 0]));
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil((pixels.length / 4) / 256));
      pass.end();
      encoder.copyBufferToBuffer(resultBuffer, 0, readbackBuffer, 0, pixels.byteLength);
      device.queue.submit([encoder.finish()]);
      await readbackBuffer.mapAsync(mapMode.READ, 0, pixels.byteLength);
      const result = new Uint8ClampedArray(readbackBuffer.getMappedRange(0, pixels.byteLength).slice(0));
      readbackBuffer.unmap();
      if (lostReason) throw new Error(lostReason);
      return result;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      destroyFrameBuffers();
      paletteLabBuffer.destroy();
      paletteColorBuffer.destroy();
      paramsBuffer.destroy();
      device.destroy();
    },
  };
}

export function pixelBuffersEqual(left: Uint8ClampedArray, right: Uint8ClampedArray) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}
