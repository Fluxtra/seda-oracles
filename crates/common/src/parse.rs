/// Scale a floating-point price to a u128 with 1e18 precision.
///
/// Returns `None` if the price is non-positive, NaN, or infinite.
///
/// Note: f64 has ~15-16 significant digits, so precision loss of up to ~1e3
/// at the 1e18 scale is expected (~1e-13% relative error). This is
/// acceptable for DeFi price feeds but callers should be aware.
///
/// Example: scale_price(25.50) => Some(~25_500_000_000_000_000_000) (± ~1e3)
pub fn scale_price(price: f64) -> Option<u128> {
    if !price.is_finite() || price <= 0.0 {
        return None;
    }
    Some((price * 1e18) as u128)
}
