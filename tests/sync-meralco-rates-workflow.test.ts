import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("scheduled Meralco sync supplies Supabase gateway authorization", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/sync-meralco-rates.yml", import.meta.url),
    "utf8"
  );

  assert.match(workflow, /SUPABASE_ANON_KEY:/);
  assert.match(workflow, /Authorization: Bearer \$SUPABASE_ANON_KEY/);
});
