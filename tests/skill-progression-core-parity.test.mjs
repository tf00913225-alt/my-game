import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {progressionParity} from "../.github/scripts/fixtures/skill-progression-core-parity.mjs";
test("shared progression retains the pre-extraction full-loaded Client catalogue and eligibility matrix",()=>{
    const baseline=JSON.parse(fs.readFileSync(new URL("./fixtures/skill-progression-core-parity.json",import.meta.url),"utf8"));
    assert.deepEqual(progressionParity(),baseline.result);
});
