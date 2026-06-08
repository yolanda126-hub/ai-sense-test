import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("hidden utility overrides mini-game display rules", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const hiddenRule = css.match(/\.hidden\s*\{[^}]*display:\s*none\s*!important[^}]*\}/);
  assert.ok(hiddenRule, ".hidden must use !important so flash frames and options can actually disappear");
});
