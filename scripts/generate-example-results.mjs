import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { defaultSettings, deserializeSettingsDocument, quantizeImage } from "../lib/palette.mjs";

const EXAMPLE_IDS = ["example-01", "example-03", "example-04", "example-05", "example-06", "example-07", "example-08", "example-09"];
const requestedIds = process.argv.slice(2);
const ids = requestedIds.length ? requestedIds : EXAMPLE_IDS;

for (const id of ids) {
  if (!EXAMPLE_IDS.includes(id)) throw new Error(`Unknown example id: ${id}`);
}

const publicDirectory = path.resolve("public", "examples");
const resultDirectory = path.join(publicDirectory, "results");
await mkdir(resultDirectory, { recursive: true });

for (const id of ids) {
  const sourcePath = path.join(publicDirectory, `${id}.png`);
  const settingsPath = path.join(publicDirectory, `${id}.json`);
  const outputPath = path.join(resultDirectory, `${id}.png`);
  const [{ data, info }, settingsText] = await Promise.all([
    sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    readFile(settingsPath, "utf8"),
  ]);
  const settings = deserializeSettingsDocument(settingsText, defaultSettings()).settings;
  const source = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const { result } = quantizeImage(source, settings, info.width, info.height);

  await sharp(Buffer.from(result.buffer, result.byteOffset, result.byteLength), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(outputPath);
  console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);
}
