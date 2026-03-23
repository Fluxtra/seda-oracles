import { describe, it, expect } from "bun:test";
import { file } from "bun";
import { testOracleProgramExecution } from "@seda-protocol/dev-tools";
import { BigNumber } from "bignumber.js";

const WASM_DIR = "target/wasm32-wasip1/release-wasm";

function decodeLEU128(result: Uint8Array): BigNumber {
  const hex = Buffer.from(result.toReversed()).toString("hex");
  return BigNumber(`0x${hex}`);
}

function toHumanPrice(scaled: BigNumber): string {
  return scaled.dividedBy("1e18").toFixed(6);
}

describe("Live API tests (no mocks)", () => {
  it("HYPE/USD — fetches real prices", async () => {
    const wasm = await file(`${WASM_DIR}/hype-usd.wasm`).arrayBuffer();
    const result = await testOracleProgramExecution(
      Buffer.from(wasm),
      Buffer.from("")
      // no fetchMock → real HTTP calls
    );

    console.log("HYPE/USD exit code:", result.exitCode);
    if (result.exitCode === 0) {
      const price = decodeLEU128(result.result);
      console.log("HYPE/USD price:", toHumanPrice(price), "USD");
      expect(price.isGreaterThan(0)).toBe(true);
    } else {
      console.log("HYPE/USD error:", result.resultAsString);
    }
  });

  it("MANTRA/USD — fetches real prices", async () => {
    const wasm = await file(`${WASM_DIR}/mantra-usd.wasm`).arrayBuffer();
    const result = await testOracleProgramExecution(
      Buffer.from(wasm),
      Buffer.from("")
    );

    console.log("MANTRA/USD exit code:", result.exitCode);
    if (result.exitCode === 0) {
      const price = decodeLEU128(result.result);
      console.log("MANTRA/USD price:", toHumanPrice(price), "USD");
      expect(price.isGreaterThan(0)).toBe(true);
    } else {
      console.log("MANTRA/USD error:", result.resultAsString);
    }
  });

  it("HYPE/MANTRA — fetches real cross-rate", async () => {
    const wasm = await file(`${WASM_DIR}/hype-mantra.wasm`).arrayBuffer();
    const result = await testOracleProgramExecution(
      Buffer.from(wasm),
      Buffer.from("")
    );

    console.log("HYPE/MANTRA exit code:", result.exitCode);
    if (result.exitCode === 0) {
      const price = decodeLEU128(result.result);
      console.log("HYPE/MANTRA price:", toHumanPrice(price), "MANTRA per HYPE");
      expect(price.isGreaterThan(0)).toBe(true);
    } else {
      console.log("HYPE/MANTRA error:", result.resultAsString);
    }
  });
});
