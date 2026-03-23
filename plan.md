# SEDA Oracle Programs - Implementation Plan

## Overview
Build 3 SEDA oracle programs (Rust/WASM) + 3 Solidity consumer contracts for HYPE/USD, MANTRA/USD, and HYPE/MANTRA price feeds on MANTRA Chain.

## Architecture
- **3 Rust crates** in a Cargo workspace + 1 shared `common` crate
- **1e18 precision** (EVM convention)
- **Multi-source per executor**: each executor fetches 3 API sources, takes local median
- **Tally**: median across executors (double redundancy)
- **Replication factor: 3** (3 executors × 3 sources = 9 data points)
- **Graceful degradation**: require ≥2 sources or error

## Steps

### Step 1: Scaffold workspace ✅
- Cargo.toml (workspace), rust-toolchain.toml, Makefile, package.json, tsconfig.json, .env.example, .gitignore
- Directory structure for crates/, tests/, integrations/evm/

### Step 2: Build `common` crate ✅
- `fetch.rs` — fetch_price(url, json_path) → Option<f64>
- `math.rs` — median(), median_u128()
- `parse.rs` — scale_price(f64 → u128 × 1e18)
- `tally.rs` — standard_tally() for all 3 oracles

### Step 3: Build HYPE/USD oracle
- Sources: Bybit, Gate.io, Coinbase
- Execution: fetch 3 → local median → scale → le_bytes
- Tally: common::standard_tally()

### Step 4: Build MANTRA/USD oracle
- Sources: Binance, Gate.io, Bybit
- Same pattern as HYPE/USD

### Step 5: Build HYPE/MANTRA cross-rate oracle
- Fetch all 6 sources, compute median(HYPE_USD) / median(MANTRA_USD)
- Guard against MANTRA median ≤ 0

### Step 6: Write Bun tests
- Per oracle: happy path, partial failure (1/3 down), total failure (<2), tally median
- Mock HTTP responses with bun:test mock

### Step 7: Build Solidity consumer contracts + Hardhat
- SedaPriceFeedBase.sol (transmit, fetchResult, latestAnswer, staleness, Ownable)
- 3 concrete contracts (override _execInputs, description)
- Hardhat config for Mantra testnet (chain ID 5887)
- Tasks: deploy, transmit, latest, deploy-all
- Contract unit tests against MockSedaCore

## Data Sources

| Oracle | Source 1 | Source 2 | Source 3 |
|--------|----------|----------|----------|
| HYPE/USD | Bybit HYPEUSDT | Gate.io HYPE_USDT | Coinbase HYPE-USD |
| MANTRA/USD | Binance MANTRAUSDT | Gate.io MANTRA_USDT | Bybit MANTRAUSDT |
| HYPE/MANTRA | Cross-rate from above 6 sources |

## Contract Addresses
- SEDA Core (Mantra Chain): `0x1Ab18aE7386043738B0507D695832893657603B0`
