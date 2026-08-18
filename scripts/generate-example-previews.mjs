import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = join(root, "public", "examples");
const previewRoot = join(sourceRoot, "previews");

async function generateDirectory(sourceDir, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const files = (await readdir(sourceDir)).filter((file) => /^example-\d+\.png$/i.test(file));
  await Promise.all(files.map(async (file) => {
    const output = join(outputDir, file.replace(/\.png$/i, ".webp"));
    await sharp(join(sourceDir, file))
      .resize({ width: 1440, height: 1440, fit: "inside", withoutEnlargement: true })
      .webp({ lossless: true, effort: 6 })
      .toFile(output);
  }));
}

await generateDirectory(sourceRoot, previewRoot);
await generateDirectory(join(sourceRoot, "results"), join(previewRoot, "results"));

console.log("Generated lossless example previews.");
