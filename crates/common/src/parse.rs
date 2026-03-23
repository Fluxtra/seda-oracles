/// Scale a floating-point price to a u128 with 1e18 precision.
///
/// Example: scale_price(25.50) => 25_500_000_000_000_000_000
pub fn scale_price(price: f64) -> u128 {
    (price * 1e18) as u128
}
