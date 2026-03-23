import { afterEach, describe, it, expect, mock } from "bun:test";
import { file } from "bun";
import {
  testOracleProgramExecution,
  testOracleProgramTally,
} from "@seda-protocol/dev-tools";
import { BigNumber } from "bignumber.js";
import { encodeU128LE, decodeBE, decodeLE, scalePrice } from "./helpers";

const WASM_PATH = "target/wasm32-wasip1/release-wasm/hype-mantra.wasm";

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

// Mock all 6 API sources
function mockAllSources(hypePrice: string, mantraPrice: string) {
  fetchMock.mockImplementation((url: URL) => {
    const host = url.host;
    const path = url.pathname + url.search;

    // HYPE/USD sources
    if (host === "api.bybit.com" && path.includes("HYPEUSDT")) {
      return new Response(
        JSON.stringify({
          result: { list: [{ lastPrice: hypePrice }] },
        })
      );
    }
    if (host === "api.gateio.ws" && path.includes("HYPE_USDT")) {
      return new Response(JSON.stringify([{ last: hypePrice }]));
    }
    if (host === "api.coinbase.com") {
      return new Response(
        JSON.stringify({ data: { amount: hypePrice } })
      );
    }

    // MANTRA/USD sources
    if (host === "api.binance.com") {
      return new Response(
        JSON.stringify({ price: mantraPrice })
      );
    }
    if (host === "api.gateio.ws" && path.includes("MANTRA_USDT")) {
      return new Response(JSON.stringify([{ last: mantraPrice }]));
    }
    if (host === "api.bybit.com" && path.includes("MANTRAUSDT")) {
      return new Response(
        JSON.stringify({
          result: { list: [{ lastPrice: mantraPrice }] },
        })
      );
    }

    return new Response("Unknown", { status: 404 });
  });
}

describe("HYPE/MANTRA Oracle - Execution Phase", () => {
  it("should compute cross-rate from 6 sources", async () => {
    mockAllSources("25.50", "0.8500");

    const oracleProgram = await file(WASM_PATH).arrayBuffer();
    const vmResult = await testOracleProgramExecution(
      Buffer.from(oracleProgram),
      Buffer.from(""),
      fetchMock
    );

    expect(vmResult.exitCode).toBe(0);

    const result = decodeLE(vmResult.result);

    // Cross-rate: 25.50 / 0.85 = 30.0
    const expected = BigNumber("30e18");
    // Allow larger tolerance for cross-rate division
    expect(result.minus(expected).abs().isLessThan("1e15")).toBe(true);
  });

  it("should succeed with partial source failures (2/3 each)", async () => {
    fetchMock.mockImplementation((url: URL) => {
      const host = url.host;
      const path = url.pathname + url.search;

      // HYPE: Bybit succeeds, Gate.io fails, Coinbase succeeds
      if (host === "api.bybit.com" && path.includes("HYPEUSDT")) {
        return new Response(
          JSON.stringify({
            result: { list: [{ lastPrice: "25.50" }] },
          })
        );
      }
      if (host === "api.gateio.ws" && path.includes("HYPE_USDT")) {
        return new Response("Error", { status: 500 });
      }
      if (host === "api.coinbase.com") {
        return new Response(
          JSON.stringify({ data: { amount: "25.40" } })
        );
      }

      // MANTRA: Binance fails, Gate.io succeeds, Bybit succeeds
      if (host === "api.binance.com") {
        return new Response("Error", { status: 500 });
      }
      if (host === "api.gateio.ws" && path.includes("MANTRA_USDT")) {
        return new Response(JSON.stringify([{ last: "0.8520" }]));
      }
      if (host === "api.bybit.com" && path.includes("MANTRAUSDT")) {
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

  it("should error when HYPE sources insufficient", async () => {
    fetchMock.mockImplementation((url: URL) => {
      const host = url.host;
      const path = url.pathname + url.search;

      // All HYPE sources fail
      if (host === "api.bybit.com" && path.includes("HYPEUSDT")) {
        return new Response("Error", { status: 500 });
      }
      if (host === "api.gateio.ws" && path.includes("HYPE_USDT")) {
        return new Response("Error", { status: 500 });
      }
      if (host === "api.coinbase.com") {
        return new Response("Error", { status: 500 });
      }

      // MANTRA sources succeed
      if (host === "api.binance.com") {
        return new Response(JSON.stringify({ price: "0.85" }));
      }
      if (host === "api.gateio.ws" && path.includes("MANTRA_USDT")) {
        return new Response(JSON.stringify([{ last: "0.85" }]));
      }
      if (host === "api.bybit.com" && path.includes("MANTRAUSDT")) {
        return new Response(
          JSON.stringify({
            result: { list: [{ lastPrice: "0.85" }] },
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

    expect(vmResult.exitCode).toBe(1);
  });

  it("should error when MANTRA sources insufficient", async () => {
    fetchMock.mockImplementation((url: URL) => {
      const host = url.host;
      const path = url.pathname + url.search;

      // HYPE sources succeed
      if (host === "api.bybit.com" && path.includes("HYPEUSDT")) {
        return new Response(
          JSON.stringify({
            result: { list: [{ lastPrice: "25.50" }] },
          })
        );
      }
      if (host === "api.gateio.ws" && path.includes("HYPE_USDT")) {
        return new Response(JSON.stringify([{ last: "25.50" }]));
      }
      if (host === "api.coinbase.com") {
        return new Response(
          JSON.stringify({ data: { amount: "25.50" } })
        );
      }

      // All MANTRA sources fail
      return new Response("Error", { status: 500 });
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

describe("HYPE/MANTRA Oracle - Tally Phase", () => {
  it("should compute median of cross-rate reveals", async () => {
    const oracleProgram = await file(WASM_PATH).arrayBuffer();

    const reveals = [
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(29.8)),
      },
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(30.0)),
      },
      {
        exitCode: 0,
        gasUsed: 0,
        inConsensus: true,
        result: encodeU128LE(scalePrice(30.2)),
      },
    ];

    const vmResult = await testOracleProgramTally(
      Buffer.from(oracleProgram),
      Buffer.from(""),
      reveals
    );

    expect(vmResult.exitCode).toBe(0);

    const result = decodeBE(vmResult.result);
    const expected = BigNumber(scalePrice(30.0).toString());
    expect(result.minus(expected).abs().isLessThan("1e12")).toBe(true);
  });
});
