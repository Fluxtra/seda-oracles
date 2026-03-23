use anyhow::Result;
use seda_sdk_rs::{elog, log, Process};

pub fn execution_phase() -> Result<()> {
    let mut prices: Vec<f64> = Vec::new();

    // Source 1: Binance
    if let Some(p) = common::fetch::fetch_price(
        "https://api.binance.com/api/v3/ticker/price?symbol=MANTRAUSDT",
        &["price"],
    ) {
        prices.push(p);
    }

    // Source 2: Gate.io
    if let Some(p) = common::fetch::fetch_price(
        "https://api.gateio.ws/api/v4/spot/tickers?currency_pair=MANTRA_USDT",
        &["0", "last"],
    ) {
        prices.push(p);
    }

    // Source 3: Bybit
    if let Some(p) = common::fetch::fetch_price(
        "https://api.bybit.com/v5/market/tickers?category=spot&symbol=MANTRAUSDT",
        &["result", "list", "0", "lastPrice"],
    ) {
        prices.push(p);
    }

    if prices.len() < 2 {
        elog!("Only {} MANTRA/USD sources, need at least 2", prices.len());
        Process::error(b"Less than 2 sources");
    }

    // Safe to unwrap: prices.len() >= 2 guarantees non-empty slice
    let median = common::math::median(&prices).unwrap();
    let scaled = match common::parse::scale_price(median) {
        Some(s) => s,
        None => {
            elog!("Failed to scale MANTRA/USD median: {}", median);
            Process::error(b"Invalid median price");
        }
    };
    log!("MANTRA/USD median: {}, scaled: {}", median, scaled);

    Process::success(&scaled.to_le_bytes());
}
