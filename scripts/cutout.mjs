// Local background removal (no network calls to paid services, no generation).
//
//   node scripts/cutout.mjs <input> <output.png>
//
// Kept separate from images.mjs on purpose: the removal library bundles its own
// image stack, and loading it next to sharp in one process is unreliable on Windows.
// The model weights are downloaded once into node_modules on first run.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { removeBackground } from "@imgly/background-removal-node";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node scripts/cutout.mjs <input> <output.png>");
  process.exit(1);
}

const blob = await removeBackground(pathToFileURL(resolve(input)).href, {
  model: "medium",
  output: { format: "image/png" },
});
await writeFile(resolve(output), Buffer.from(await blob.arrayBuffer()));
console.log(`wrote ${output}`);
