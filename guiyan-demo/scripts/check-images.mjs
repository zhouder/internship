import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  resourceArtwork,
  additionalResourceArtwork,
} from "../server/resource-artwork.mjs";
import { catalogResources } from "../server/catalog-content.mjs";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const hashes = new Map();
const paths = new Set();
function check(image, label) {
  assert.match(image, /^\/images\/[a-z0-9/.-]+\.webp$/);
  const filename = path.resolve(root, "." + image);
  assert.ok(
    filename.startsWith(root),
    `Image must stay inside public: ${image}`,
  );
  assert.ok(existsSync(filename), `Missing ${label}: ${image}`);
  const bytes = readFileSync(filename);
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.ok(
    !hashes.has(hash),
    `${label} repeats image content from ${hashes.get(hash)}`,
  );
  assert.ok(!paths.has(image), `${label} repeats image URL: ${image}`);
  hashes.set(hash, label);
  paths.add(image);
}
assert.equal(resourceArtwork.length, 22 + catalogResources.length);
for (const resource of [...resourceArtwork, ...additionalResourceArtwork]) {
  check(resource.image, resource.name);
  const card = path.resolve(
    root,
    "." + resource.image.replace(/\.webp$/, "-card.webp"),
  );
  assert.ok(
    existsSync(card),
    `Missing responsive card image: ${resource.image}`,
  );
}
for (const image of [
  "/images/performance.webp",
  "/images/desktop-performance.webp",
  "/images/hero-travel.webp",
  "/images/hero-craft.webp",
  "/images/story-travel.webp",
  "/images/story-craft.webp",
])
  check(image, image);
console.log(
  `Image checks passed: ${resourceArtwork.length + additionalResourceArtwork.length} independent resource covers, 6 independent banner/topic images, no duplicate URLs or identical file contents, all responsive covers present.`,
);
