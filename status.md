# SEDA Oracle Programs - Build Status

## Progress

| # | Task | Status |
|---|------|--------|
| 1 | Scaffold workspace | ✅ Done |
| 2 | Build common crate | ✅ Done |
| 3 | Build HYPE/USD oracle | ✅ Done |
| 4 | Build MANTRA/USD oracle | ✅ Done |
| 5 | Build HYPE/MANTRA oracle | ✅ Done |
| 6 | Write Bun tests | ✅ Done |
| 7 | Solidity contracts + Hardhat | ✅ Done |

## Verification

- **Rust compiles**: `cargo check --target wasm32-wasip1` — 0 errors, 0 warnings
- **WASM binaries built**: `cargo build --target wasm32-wasip1 --profile release-wasm`
  - `hype-usd.wasm` — 294KB
  - `mantra-usd.wasm` — 293KB
  - `hype-mantra.wasm` — 294KB
- **Solidity compiles**: `npx hardhat compile` — 11 files compiled successfully
- **Contract tests pass**: `npx hardhat test` — 11 passing
- **Bun tests**: Written, require `bun test` to run (bun not installed on this machine)

## Files Created

### Workspace Root
- `Cargo.toml` - Workspace with 4 members
- `rust-toolchain.toml` - Rust 1.90.0 + wasm32-wasip1
- `Makefile` - Build all 3 WASM binaries
- `package.json` - Bun + SEDA dev tools
- `tsconfig.json`
- `.env.example`
- `.gitignore`
- `plan.md` - Implementation plan
- `status.md` - This file

### Common Crate (`crates/common/`)
- `Cargo.toml`
- `src/lib.rs` - Re-exports
- `src/fetch.rs` - HTTP fetch + JSON path traversal
- `src/math.rs` - median(), median_u128()
- `src/parse.rs` - scale_price() (f64 → u128 × 1e18)
- `src/tally.rs` - standard_tally() for EVM output

### HYPE/USD Oracle (`crates/hype-usd/`)
- `Cargo.toml`
- `src/main.rs` - #[oracle_program] entry
- `src/execution_phase.rs` - Fetch Bybit + Gate.io + Coinbase
- `src/tally_phase.rs` - Delegates to common::standard_tally

### MANTRA/USD Oracle (`crates/mantra-usd/`)
- `Cargo.toml`
- `src/main.rs` - #[oracle_program] entry
- `src/execution_phase.rs` - Fetch Binance + Gate.io + Bybit
- `src/tally_phase.rs` - Delegates to common::standard_tally

### HYPE/MANTRA Oracle (`crates/hype-mantra/`)
- `Cargo.toml`
- `src/main.rs` - #[oracle_program] entry
- `src/execution_phase.rs` - Fetch all 6 sources, cross-rate division
- `src/tally_phase.rs` - Delegates to common::standard_tally

### Bun Tests (`tests/`)
- `hype-usd.test.ts` - 4 tests (happy path, partial, total failure, tally)
- `mantra-usd.test.ts` - 4 tests
- `hype-mantra.test.ts` - 5 tests (includes both-side failures)

### Solidity Contracts (`integrations/evm/`)
- `package.json`
- `hardhat.config.ts` - Mantra testnet (chain 5887)
- `tsconfig.json`
- `seda.config.ts` - SEDA Core address mapping
- `contracts/base/SedaPriceFeedBase.sol` - Shared base (transmit, fetchResult, staleness)
- `contracts/HypeUsdPriceFeed.sol`
- `contracts/MantraUsdPriceFeed.sol`
- `contracts/HypeMantraPriceFeed.sol`
- `contracts/test/MockSedaCore.sol` - Mock for testing
- `tasks/index.ts` - Task barrel export
- `tasks/deploy.ts` - Deploy task + deploy-all
- `tasks/transmit.ts` - Transmit data request
- `tasks/latest.ts` - Read latest price
- `test/PriceFeed.test.ts` - 11 tests (all passing)
