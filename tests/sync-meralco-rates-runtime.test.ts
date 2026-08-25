import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Meralco sync does not load Node-only pdfjs-dist inside the Deno Edge Runtime", async () => {
  const source = await readFile(
    new URL("../supabase/functions/sync-meralco-rates/index.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /import\s+.*pdfjs-dist/);
  assert.doesNotMatch(source, /pdfjsLib/);
});
