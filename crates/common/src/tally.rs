use anyhow::Result;
use seda_sdk_rs::{elog, get_reveals, log, Process};

use crate::math::median_u128;

/// Standard tally phase used by all 3 oracle programs.
///
/// Collects u128 prices from consensus reveals (little-endian 16-byte),
/// computes median, outputs big-endian for EVM decoding via Process::success.
pub fn standard_tally() -> Result<()> {
    let reveals = get_reveals()?;
    let mut prices: Vec<u128> = Vec::new();

    for reveal in reveals {
        if reveal.body.exit_code != 0 {
            elog!("Skipping reveal with exit code {}", reveal.body.exit_code);
            continue;
        }

        let bytes: [u8; 16] = match reveal.body.reveal.try_into() {
            Ok(b) => b,
            Err(_) => {
                elog!("Reveal body is not 16 bytes, skipping");
                continue;
            }
        };

        let price = u128::from_le_bytes(bytes);
        if price == 0 {
            elog!("Skipping zero price reveal");
            continue;
        }

        log!("Tally received price: {}", price);
        prices.push(price);
    }

    if prices.is_empty() {
        Process::error(b"No valid reveals to tally");
    }

    let result = median_u128(&mut prices);
    log!("Tally median result: {}", result);

    // Big-endian for EVM decoding: uint128(bytes16(result.result))
    Process::success(&result.to_be_bytes());
}
