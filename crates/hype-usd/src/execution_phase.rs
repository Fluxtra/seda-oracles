use anyhow::Result;
use seda_sdk_rs::{log, Process};

pub fn execution_phase() -> Result<()> {
    let mut prices: Vec<f64> = Vec::new();

    // Source 1: Bybit
    if let Some(p) = common::fetch::fetch_price(
        "https://api.bybit.com/v5/market/tickers?category=spot&symbol=HYPEUSDT",
        &["result", "list", "0", "lastPrice"],
    ) {
        prices.push(p);
    }

    // Source 2: Gate.io
    if let Some(p) = common::fetch::fetch_price(
        "https://api.gateio.ws/api/v4/spot/tickers?currency_pair=HYPE_USDT",
        &["0", "last"],
    ) {
        prices.push(p);
    }

    // Source 3: Coinbase
    if let Some(p) = common::fetch::fetch_price(
        "https://api.coinbase.com/v2/prices/HYPE-USD/spot",
        &["data", "amount"],
    ) {
        prices.push(p);
    }

    if prices.len() < 2 {
        Process::error(b"Less than 2 sources");
    }

    let median = common::math::median(&prices);
    let scaled = common::parse::scale_price(median);
    log!("HYPE/USD median: {}, scaled: {}", median, scaled);

    Process::success(&scaled.to_le_bytes());
}
