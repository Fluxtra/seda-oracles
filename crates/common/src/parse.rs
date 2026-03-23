/// Scale a floating-point price to a u128 with 1e18 precision.
///
/// Note: f64 has ~15-16 significant digits, so precision loss of up to ~1e3
/// at the 1e18 scale is expected (~0.000000004% relative error). This is
/// acceptable for DeFi price feeds but callers should be aware.
///
/// Example: scale_price(25.50) => ~25_500_000_000_000_000_000 (± ~1e3)
pub fn scale_price(price: f64) -> u128 {
    // Guard against negative/NaN/infinite producing nonsensical results
    if !price.is_finite() || price <= 0.0 {
        return 0;
    }
    (price * 1e18) as u128
}
