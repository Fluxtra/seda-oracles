use anyhow::Result;
use seda_sdk_rs::{elog, log, Process};

#[allow(unreachable_code)]
pub fn execution_phase() -> Result<()> {
    // ---------- HYPE/USD sources ----------
    let mut hype_prices: Vec<f64> = Vec::new();

    // Source 1: Bybit
    if let Some(p) = common::fetch::fetch_price(
        "https://api.bybit.com/v5/market/tickers?category=spot&symbol=HYPEUSDT",
        &["result", "list", "0", "lastPrice"],
    ) {
        hype_prices.push(p);
    }

    // Source 2: Gate.io
    if let Some(p) = common::fetch::fetch_price(
        "https://api.gateio.ws/api/v4/spot/tickers?currency_pair=HYPE_USDT",
        &["0", "last"],
    ) {
        hype_prices.push(p);
    }

    // Source 3: Coinbase
    if let Some(p) = common::fetch::fetch_price(
        "https://api.coinbase.com/v2/prices/HYPE-USD/spot",
        &["data", "amount"],
    ) {
        hype_prices.push(p);
    }

    // ---------- MANTRA/USD sources ----------
    let mut mantra_prices: Vec<f64> = Vec::new();

    // Source 1: Binance
    if let Some(p) = common::fetch::fetch_price(
        "https://api.binance.com/api/v3/ticker/price?symbol=MANTRAUSDT",
        &["price"],
    ) {
        mantra_prices.push(p);
    }

    // Source 2: Gate.io
    if let Some(p) = common::fetch::fetch_price(
        "https://api.gateio.ws/api/v4/spot/tickers?currency_pair=MANTRA_USDT",
        &["0", "last"],
    ) {
        mantra_prices.push(p);
    }

    // Source 3: Bybit
    if let Some(p) = common::fetch::fetch_price(
        "https://api.bybit.com/v5/market/tickers?category=spot&symbol=MANTRAUSDT",
        &["result", "list", "0", "lastPrice"],
    ) {
        mantra_prices.push(p);
    }

    // ---------- Validation ----------
    if hype_prices.len() < 2 {
        elog!("Only {} HYPE/USD sources, need at least 2", hype_prices.len());
        Process::error(b"Less than 2 HYPE/USD sources");
        return Ok(());
    }

    if mantra_prices.len() < 2 {
        elog!("Only {} MANTRA/USD sources, need at least 2", mantra_prices.len());
        Process::error(b"Less than 2 MANTRA/USD sources");
        return Ok(());
    }

    // ---------- Cross-rate ----------
    let hype_median = match common::math::median(&hype_prices) {
        Some(m) => m,
        None => {
            Process::error(b"No valid HYPE prices");
            return Ok(());
        }
    };
    let mantra_median = match common::math::median(&mantra_prices) {
        Some(m) => m,
        None => {
            Process::error(b"No valid MANTRA prices");
            return Ok(());
        }
    };

    if mantra_median <= 0.0 {
        elog!("MANTRA/USD median is non-positive: {}", mantra_median);
        Process::error(b"MANTRA/USD median non-positive");
        return Ok(());
    }

    let hype_mantra = hype_median / mantra_median;
    let scaled = common::parse::scale_price(hype_mantra);
    log!(
        "HYPE/MANTRA cross-rate: {} (HYPE/USD {} / MANTRA/USD {}), scaled: {}",
        hype_mantra, hype_median, mantra_median, scaled
    );

    Process::success(&scaled.to_le_bytes());
    return Ok(());
}
