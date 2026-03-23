/// Compute the median of a slice of f64 values.
/// Panics if the slice is empty.
pub fn median(values: &[f64]) -> f64 {
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let len = sorted.len();
    if len % 2 == 0 {
        (sorted[len / 2 - 1] + sorted[len / 2]) / 2.0
    } else {
        sorted[len / 2]
    }
}

/// Compute the median of a vector of u128 values.
/// Panics if the vector is empty.
pub fn median_u128(values: &mut Vec<u128>) -> u128 {
    values.sort();
    let len = values.len();
    if len % 2 == 0 {
        (values[len / 2 - 1] + values[len / 2]) / 2
    } else {
        values[len / 2]
    }
}
