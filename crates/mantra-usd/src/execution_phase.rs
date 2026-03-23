use anyhow::Result;
use seda_sdk_rs::{log, Process};

pub fn execution_phase() -> Result<()> {
    let mut prices: Vec<f64> = Vec::new();

    // Source 1: Binance
    if let Some(price) = common::fetch::fetch_price(
        "https://api.binance.com/api/v3/ticker/price?symbol=MANTRAUSDT",
        &["price"],
    ) {
        prices.push(price);
    }

    // Source 2: Gate.io
    if let Some(price) = common::fetch::fetch_price(
        "https://api.gateio.ws/api/v4/spot/tickers?currency_pair=MANTRA_USDT",
        &["0", "last"],
    ) {
        prices.push(price);
    }

    // Source 3: Bybit
    if let Some(price) = common::fetch::fetch_price(
        "https://api.bybit.com/v5/market/tickers?category=spot&symbol=MANTRAUSDT",
        &["result", "list", "0", "lastPrice"],
    ) {
        prices.push(price);
    }

    if prices.len() < 2 {
        Process::error(b"Less than 2 sources");
    }

    let median = common::math::median(&prices);
    let scaled = common::parse::scale_price(median);

    log!("MANTRA/USD median: {}, scaled: {}", median, scaled);

    Process::success(&scaled.to_le_bytes());
}
