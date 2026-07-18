#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { encode as toonEncode } from "@toon-format/toon";

const fixturePath = resolve(process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1]) ?? "scripts/fixtures/toon-sprint-sample.json");
const asJson = process.argv.includes("--json");

const approximateTokens = (value) => Math.ceil(value.length / 4);
const reductionPercent = (before, after) => (before === 0 ? 0 : ((before - after) / before) * 100);

const source = await readFile(fixturePath, "utf8");
const payload = JSON.parse(source);
const json = JSON.stringify(payload);
const toon = toonEncode(payload);

const result = {
  fixture: fixturePath,
  jsonChars: json.length,
  toonChars: toon.length,
  jsonApproxTokens: approximateTokens(json),
  toonApproxTokens: approximateTokens(toon),
  charReductionPercent: Number(reductionPercent(json.length, toon.length).toFixed(1)),
  approxTokenReductionPercent: Number(
    reductionPercent(approximateTokens(json), approximateTokens(toon)).toFixed(1)
  )
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("TOON encoding benchmark");
  console.log(`Fixture: ${result.fixture}`);
  console.log(`JSON: ${result.jsonChars} chars (~${result.jsonApproxTokens} tokens)`);
  console.log(`TOON: ${result.toonChars} chars (~${result.toonApproxTokens} tokens)`);
  console.log(`Reduction: ${result.charReductionPercent}% chars, ~${result.approxTokenReductionPercent}% tokens`);
}
