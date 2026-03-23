/// Compute the median of a slice of f64 values.
/// Returns `None` if the slice is empty.
pub fn median(values: &[f64]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.total_cmp(b));
    let len = sorted.len();
    if len % 2 == 0 {
        Some((sorted[len / 2 - 1] + sorted[len / 2]) / 2.0)
    } else {
        Some(sorted[len / 2])
    }
}

/// Compute the median of a slice of u128 values (sorts in-place).
/// Returns `None` if the slice is empty.
/// Uses overflow-safe averaging for even-length slices.
pub fn median_u128(values: &mut [u128]) -> Option<u128> {
    if values.is_empty() {
        return None;
    }
    values.sort();
    let len = values.len();
    if len % 2 == 0 {
        let a = values[len / 2 - 1];
        let b = values[len / 2];
        // Overflow-safe average: a/2 + b/2 + (a%2 + b%2)/2
        Some(a / 2 + b / 2 + (a % 2 + b % 2) / 2)
    } else {
        Some(values[len / 2])
    }
}
