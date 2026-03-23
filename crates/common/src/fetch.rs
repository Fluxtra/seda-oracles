use seda_sdk_rs::{elog, http_fetch, log};

/// Fetch a price from a URL and extract a value by traversing a JSON path.
///
/// `json_path` is a slice of keys/indices to traverse, e.g. `&["result", "list", "0", "lastPrice"]`.
/// Returns `None` if the HTTP request fails or the path doesn't resolve to a parseable float.
pub fn fetch_price(url: &str, json_path: &[&str]) -> Option<f64> {
    let response = http_fetch(url, None);

    if !response.is_ok() {
        elog!(
            "HTTP error from {}: status {}",
            url,
            response.status
        );
        return None;
    }

    let value: serde_json::Value = match serde_json::from_slice(&response.bytes) {
        Ok(v) => v,
        Err(e) => {
            elog!("JSON parse error from {}: {}", url, e);
            return None;
        }
    };

    let mut current = &value;
    for &segment in json_path {
        // Try as array index first, then as object key
        if let Ok(idx) = segment.parse::<usize>() {
            current = current.get(idx)?;
        } else {
            current = current.get(segment)?;
        }
    }

    // Extract the price as f64 - handle both string and number JSON values
    let price = match current {
        serde_json::Value::String(s) => s.parse::<f64>().ok()?,
        serde_json::Value::Number(n) => n.as_f64()?,
        _ => {
            elog!("Unexpected JSON type at path in {}", url);
            return None;
        }
    };

    if price <= 0.0 || !price.is_finite() {
        elog!("Invalid price {} from {}", price, url);
        return None;
    }

    log!("Fetched price {} from {}", price, url);
    Some(price)
}
