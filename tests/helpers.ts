import { BigNumber } from "bignumber.js";

/** Encode a u128 as 16-byte little-endian Buffer */
export function encodeU128LE(value: bigint): Buffer {
  const buf = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    buf[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return buf;
}

/** Decode big-endian u128 from Uint8Array to BigNumber */
export function decodeBE(bytes: Uint8Array): BigNumber {
  const hex = Buffer.from(bytes).toString("hex");
  return BigNumber(`0x${hex}`);
}

/** Decode little-endian u128 from Uint8Array to BigNumber */
export function decodeLE(bytes: Uint8Array): BigNumber {
  const reversed = Buffer.from(bytes);
  reversed.reverse();
  const hex = reversed.toString("hex");
  return BigNumber(`0x${hex}`);
}

/** Scale a price to 1e18 u128 */
export function scalePrice(price: number): bigint {
  return BigInt(Math.floor(price * 1e18));
}
