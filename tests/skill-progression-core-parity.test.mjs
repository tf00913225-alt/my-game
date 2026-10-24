import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {progressionParity} from "../.github/scripts/fixtures/skill-progression-core-parity.mjs";
test("shared progression retains the full-loaded eligibility matrix after legacy storm retirement",()=>{
    const baseline=JSON.parse(fs.readFileSync(new URL("./fixtures/skill-progression-core-parity.json",import.meta.url),"utf8"));
    assert.deepEqual(progressionParity(),baseline.retiredStormResult);
    assert.equal(baseline.retiredStormResult.catalogueSize,baseline.result.catalogueSize-1);
    // One data row plus 4 elements × 10 levels × 6 point balances × 9 eligibility checks.
    assert.equal(baseline.result.cases-baseline.retiredStormResult.cases,2161);
});
