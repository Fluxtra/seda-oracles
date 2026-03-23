import { afterEach, describe, it, expect, mock } from "bun:test";
import { file } from "bun";
import {
  testOracleProgramExecution,
  testOracleProgramTally,
} from "@seda-protocol/dev-tools";
import { BigNumber } from "bignumber.js";

const WASM_PATH = "target/wasm32-wasip1/release-wasm/mantra-usd.wasm";

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

function encodeU128LE(value: bigint): Buffer {
  const buf = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    buf[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return buf;
}

function decodeBE(bytes: Uint8Array): BigNumber {
  const hex = Buffer.from(bytes).toString("hex");
  return BigNumber(`0x${hex}`);
}

function scalePrice(price: number): bigint {
  return BigInt(Math.floor(price * 1e18));
}

describe("MANTRA/USD Oracle - Execution Phase", () => {
  it("should return median of 3 sources", async () => {
    fetchMock.mockImplementation((url: URL) => {
      const host = url.host;
      if (host === "api.binance.com") {
        return new Response(
          JSON.stringify({ price: "0.8500" })
        );
      }
      if (host === "api.gateio.ws") {
        return new Response(JSON.stringify([{ last: "0.8520" }]));
      }
      if (host === "api.bybit.com") {
        return new Response(
          JSON.stringify({
            result: { list: [{ lastPrice: "0.8480" }] },
          })
        );
      }
      return new Response("Unknown", { status: 404 });
    });

    const oracleProgram = await file(WASM_PATH).arrayBuffer();
    const vmResult = await testOracleProgramExecution(
      Buffer.from(oracleProgram),
      Buffer.from(""),
      fetchMock
    );

    expect(vmResult.exitCode).toBe(0);

    const hex = Buffer.from(vmResult.result.toReversed()).toString("hex");
    const result = BigNumber(`0x${hex}`);

    // Median of 0.8480, 0.8500, 0.8520 = 0.8500
    const expected = BigNumber("0.85e18");
    expect(result.minus(expected).abs().isLessThan("1e12")).toBe(true);
  });

  it("should succeed with 2 of 3 sources", async () => {
    fetchMock.mockImplementation((url: URL) => {
      const host = url.host;
      if (host === "api.binance.com") {
        return new Response("Server Error", { status: 500 });
      }
      if (host === "api.gateio.ws") {
        return new Response(JSON.stringify([{ last: "0.8520" }]));
      }
      if (host === "api.bybit.com") {
        return new Response(
          JSON.stringify({
            result: { list: [{ lastPrice: "0.8480" }] },
          })
        );
      }
      return new Response("Unknown", { status: 404 });
    });

    const oracleProgram = await file(WASM_PATH).arrayBuffer();
    const vmResult = await testOracleProgramExecution(
      Buffer.from(oracleProgram),
      Buffer.from(""),
      fetchMock
    );

    expect(vmResult.exitCode).toBe(0);
  });

  it("should error with fewer than 2 sources", async () => {
    fetchMock.mockImplementation(() => {
      return new Response("Server Error", { status: 500 });
    });

    const oracleProgram = await file(WASM_PATH).arrayBuffer();
    const vmResult = await testOracleProgramExecution(
      Buffer.from(oracleProgram),
      Buffer.from(""),
      fetchMock
    );

    expect(vmResult.exitCode).toBe(1);
  });
});

describe("MANTRA/USD Oracle - Tally Phase", () => {
  it("should compute median of multiple reveals", async () => {
    const oracleProgram = await file(WASM_PATH).arrayBuffer();

    const reveals = [
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(0.848)),
      },
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(0.85)),
      },
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(0.852)),
      },
    ];

    const vmResult = await testOracleProgramTally(
      Buffer.from(oracleProgram),
      Buffer.from(""),
      reveals
    );

    expect(vmResult.exitCode).toBe(0);

    const result = decodeBE(vmResult.result);
    const expected = BigNumber(scalePrice(0.85).toString());
    expect(result.minus(expected).abs().isLessThan("1e12")).toBe(true);
  });
});
