# SEDA Oracle Programs

Price feed oracle programs for [SEDA Network](https://seda.xyz), delivering HYPE/USD, MANTRA/USD, and HYPE/MANTRA prices to MANTRA Chain's EVM layer.

## Overview

This repo contains two components:

1. **Oracle Programs** (Rust → WASM) — Run on SEDA's decentralized executor network, fetching prices from multiple CEX APIs
2. **Consumer Contracts** (Solidity) — Deployed on MANTRA Chain EVM, reading oracle results from SEDA Core

### Price Feeds

| Oracle | Sources | Method |
|--------|---------|--------|
| **HYPE/USD** | Bybit, Gate.io, Coinbase | Median of 3 sources, scaled to 1e18 |
| **MANTRA/USD** | Binance, Gate.io, Bybit | Median of 3 sources, scaled to 1e18 |
| **HYPE/MANTRA** | All 6 sources above | Cross-rate: median(HYPE/USD) / median(MANTRA/USD) |

## Architecture

### End-to-End Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SEDA NETWORK                                  │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │
│  │ Executor 1 │  │ Executor 2 │  │ Executor 3 │  (replication = 3)  │
│  │            │  │            │  │            │                      │
│  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │                     │
│  │ │  WASM  │ │  │ │  WASM  │ │  │ │  WASM  │ │                     │
│  │ │ Oracle │ │  │ │ Oracle │ │  │ │ Oracle │ │                     │
│  │ └───┬────┘ │  │ └───┬────┘ │  │ └───┬────┘ │                     │
│  │     │      │  │     │      │  │     │      │                     │
│  └─────┼──────┘  └─────┼──────┘  └─────┼──────┘                     │
│        │               │               │                             │
│        ▼               ▼               ▼                             │
│  ┌─────────────────────────────────────────┐                         │
│  │          TALLY PHASE                    │                         │
│  │  median(executor1, executor2, executor3)│                         │
│  │  → big-endian u128 result              │                         │
│  └────────────────────┬────────────────────┘                         │
│                       │                                              │
└───────────────────────┼──────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    MANTRA CHAIN EVM                                    │
│                                                                       │
│  ┌──────────────┐         ┌─────────────────────────────────┐         │
│  │  SEDA Core   │◄────────│  Consumer Contract              │         │
│  │  (resolver)  │         │  (HypeUsdPriceFeed, etc.)       │         │
│  │              │────────►│                                 │         │
│  └──────────────┘         │  transmit()     → post request  │         │
│                           │  fetchResult()  → read result   │         │
│                           │  latestAnswer() → uint128 price │         │
│                           └─────────────────────────────────┘         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Execution Phase (per executor)

Each WASM oracle program runs independently on every executor:

```
  Bybit API ──────┐
                   │
  Gate.io API ─────┼──► median(prices) ──► scale to u128 × 1e18 ──► reveal
                   │
  Coinbase API ────┘
           (or Binance)

  Requires ≥2 of 3 sources. Errors if fewer respond.
```

### Tally Phase

After all executors submit reveals, the tally program aggregates them:

```
  Executor 1 reveal (u128 LE) ───┐
                                  │
  Executor 2 reveal (u128 LE) ───┼──► median(reveals) ──► u128 BE ──► SEDA Core
                                  │
  Executor 3 reveal (u128 LE) ───┘

  Skips reveals with non-zero exit codes or zero prices.
```

### Consumer Contract Flow

```
                 transmit()              SEDA resolves           fetchResult()
  Caller ──────────────────► SEDA Core ─────────────────► Result ──────────────► latestAnswer()
                                                                                   │
                                                                             uint128 price
                                                                             (18 decimals)
```

## Project Structure

```
├── crates/
│   ├── common/             # Shared: HTTP fetch, median, 1e18 scaling, tally
│   │   └── src/
│   │       ├── fetch.rs    # fetch_price(url, json_path) → Option<f64>
│   │       ├── math.rs     # median(), median_u128()
│   │       ├── parse.rs    # scale_price(f64 → u128 × 1e18)
│   │       └── tally.rs    # standard_tally() — median across executor reveals
│   ├── hype-usd/           # HYPE/USD oracle (Bybit, Gate.io, Coinbase)
│   ├── mantra-usd/         # MANTRA/USD oracle (Binance, Gate.io, Bybit)
│   └── hype-mantra/        # HYPE/MANTRA cross-rate oracle (all 6 sources)
├── integrations/evm/       # Solidity consumer contracts + Hardhat
│   ├── contracts/
│   │   ├── base/SedaPriceFeedBase.sol
│   │   ├── HypeUsdPriceFeed.sol
│   │   ├── MantraUsdPriceFeed.sol
│   │   └── HypeMantraPriceFeed.sol
│   ├── tasks/              # deploy, transmit, latest
│   └── test/               # 11 contract tests
├── tests/                  # Bun/WASM integration tests (14 unit + 3 live)
├── Cargo.toml              # Rust workspace
├── Makefile                # Build all WASM binaries
└── package.json            # Bun test runner + SEDA dev tools
```

## Prerequisites

- **Rust 1.90+** with `wasm32-wasip1` target (auto-configured via `rust-toolchain.toml`)
- **Bun** — for running WASM oracle tests
- **Node.js 18+** — for Hardhat / Solidity contracts
- **wasm-strip** ([wabt](https://github.com/WebAssembly/wabt)) and **wasm-opt** ([binaryen](https://github.com/WebAssembly/binaryen)) — for optimising WASM binaries

## Getting Started

### 1. Install dependencies

```bash
# Oracle program test dependencies
bun install

# Solidity contract dependencies
cd integrations/evm && npm install && cd ../..
```

### 2. Build WASM binaries

```bash
# Build all 3 oracle programs (~294KB each)
make build

# Or build individually
make build-hype-usd
make build-mantra-usd
make build-hype-mantra
```

Output binaries are written to `target/wasm32-wasip1/release-wasm/`.

### 3. Run tests

```bash
# WASM oracle tests (mocked HTTP responses)
bun test tests/

# Live tests against real CEX APIs
bun test tests/live.test.ts

# Solidity contract tests
cd integrations/evm && npx hardhat test
```

### 4. Check Rust compilation

```bash
cargo check --target wasm32-wasip1
```

## Solidity Contracts

All three consumer contracts inherit from `SedaPriceFeedBase`, which provides:

| Function | Description |
|----------|-------------|
| `transmit()` | Posts a data request to SEDA Core (replication factor 3) |
| `fetchResult()` | Reads the resolved result, validates consensus + exit code, stores price |
| `latestAnswer()` | Returns the latest price (`uint128`, 18 decimals) |
| `latestAnswerSafe()` | Same as above but reverts if the price exceeds the staleness threshold |
| `decimals()` | Returns `18` |
| `setOracleProgramId()` | Owner-only: update the WASM program ID |
| `setStalenessThreshold()` | Owner-only: update the staleness window |

### Deploying to MANTRA Testnet

```bash
cp .env.example .env
# Set PRIVATE_KEY and oracle program IDs

cd integrations/evm

# Deploy all 3 contracts
npx hardhat deploy-all --network mantraTestnet

# Deploy individually
npx hardhat deploy --contract HypeUsdPriceFeed --network mantraTestnet

# Post a data request
npx hardhat transmit --contract <address> --network mantraTestnet

# Read latest price
npx hardhat latest --contract <address> --network mantraTestnet
```

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Deployer wallet private key |
| `MANTRA_RPC_URL` | MANTRA Chain EVM RPC (default: `https://evm.dukong.mantrachain.io`) |
| `SEDA_CORE_ADDRESS` | SEDA Core contract on MANTRA Chain |
| `HYPE_USD_PROGRAM_ID` | WASM program ID after uploading to SEDA |
| `MANTRA_USD_PROGRAM_ID` | WASM program ID after uploading to SEDA |
| `HYPE_MANTRA_PROGRAM_ID` | WASM program ID after uploading to SEDA |

## Known Addresses

| Contract | Address |
|----------|---------|
| SEDA Core (MANTRA Testnet) | `0x1Ab18aE7386043738B0507D695832893657603B0` |
| Consumer contracts | Not yet deployed |

## Deployment Checklist

- [x] Rust oracle programs compile and build to WASM
- [x] Bun tests pass (14 unit + 3 live)
- [x] Solidity contracts compile and pass tests (11/11)
- [ ] Upload WASM binaries to SEDA network
- [ ] Deploy consumer contracts to MANTRA testnet
- [ ] End-to-end: transmit → fetchResult → latestAnswer on-chain
