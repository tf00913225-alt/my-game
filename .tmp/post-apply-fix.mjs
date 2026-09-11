import fs from "node:fs";
const path="tests/v174-mobile-ui-exp-guards.test.js";
let source=fs.readFileSync(path,"utf8");
source=source.split("\n").map(line=>line.startsWith("assert.match(slots,/querySelectorAll")
  ? `assert.ok(slots.includes("querySelectorAll('[onclick*=\\\"openCharacterCreation\\\"]')"),"current character creation slot selector missing");`
  : line).join("\n");
fs.writeFileSync(path,source);
console.log("Adjusted generated source-contract assertion.");
