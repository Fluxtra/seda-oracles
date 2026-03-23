import { afterEach, describe, it, expect, mock } from "bun:test";
import { file } from "bun";
import {
  testOracleProgramExecution,
  testOracleProgramTally,
} from "@seda-protocol/dev-tools";
import { BigNumber } from "bignumber.js";
import { encodeU128LE, decodeBE, decodeLE, scalePrice } from "./helpers";

const WASM_PATH = "target/wasm32-wasip1/release-wasm/hype-usd.wasm";

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe("HYPE/USD Oracle - Execution Phase", () => {
  it("should return median of 3 sources", async () => {
    fetchMock.mockImplementation((url: URL) => {
      const host = url.host;
      if (host === "api.bybit.com") {
        return new Response(
          JSON.stringify({
            result: { list: [{ lastPrice: "25.50" }] },
          })
        );
      }
      if (host === "api.gateio.ws") {
        return new Response(JSON.stringify([{ last: "25.60" }]));
      }
      if (host === "api.coinbase.com") {
        return new Response(
          JSON.stringify({ data: { amount: "25.40" } })
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

    // Result is little-endian u128
    const result = decodeLE(vmResult.result);

    // Median of 25.40, 25.50, 25.60 = 25.50
    const expected = BigNumber("25.5e18");
    // Allow small floating-point tolerance
    expect(result.minus(expected).abs().isLessThan("1e12")).toBe(true);
  });

  it("should succeed with 2 of 3 sources", async () => {
    fetchMock.mockImplementation((url: URL) => {
      const host = url.host;
      if (host === "api.bybit.com") {
        return new Response(
          JSON.stringify({
            result: { list: [{ lastPrice: "25.50" }] },
          })
        );
      }
      if (host === "api.gateio.ws") {
        return new Response("Server Error", { status: 500 });
      }
      if (host === "api.coinbase.com") {
        return new Response(
          JSON.stringify({ data: { amount: "25.40" } })
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

    const result = decodeLE(vmResult.result);

    // Median of 25.40, 25.50 = 25.45
    const expected = BigNumber("25.45e18");
    expect(result.minus(expected).abs().isLessThan("1e12")).toBe(true);
  });

  it("should error with fewer than 2 sources", async () => {
    fetchMock.mockImplementation((url: URL) => {
      const host = url.host;
      if (host === "api.bybit.com") {
        return new Response(
          JSON.stringify({
            result: { list: [{ lastPrice: "25.50" }] },
          })
        );
      }
      // Both Gate.io and Coinbase fail
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

describe("HYPE/USD Oracle - Tally Phase", () => {
  it("should compute median of multiple reveals", async () => {
    const oracleProgram = await file(WASM_PATH).arrayBuffer();

    // 3 executor reveals with slightly different prices
    const reveals = [
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(25.40)),
      },
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(25.50)),
      },
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(25.60)),
      },
    ];

    const vmResult = await testOracleProgramTally(
      Buffer.from(oracleProgram),
      Buffer.from(""),
      reveals
    );

    expect(vmResult.exitCode).toBe(0);

    // Tally result is big-endian
    const result = decodeBE(vmResult.result);
    const expected = BigNumber(scalePrice(25.50).toString());
    expect(result.minus(expected).abs().isLessThan("1e12")).toBe(true);
  });

  it("should skip reveals with non-zero exit code", async () => {
    const oracleProgram = await file(WASM_PATH).arrayBuffer();

    const reveals = [
      {
        exitCode: 1, // Error - should be skipped
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(999.99)),
      },
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(25.50)),
      },
    ];

    const vmResult = await testOracleProgramTally(
      Buffer.from(oracleProgram),
      Buffer.from(""),
      reveals
    );

    expect(vmResult.exitCode).toBe(0);
    const result = decodeBE(vmResult.result);
    const expected = BigNumber(scalePrice(25.50).toString());
    expect(result.minus(expected).abs().isLessThan("1e12")).toBe(true);
  });
});
