export const SEDA_CORE_ADDRESS: Record<number, string> = {
  // MANTRA Dukong Testnet (chain ID 5887)
  5887: "0x67dFAa537284EAd0F5Abf8C05f7F12013A86667B",
  // MANTRA Mainnet (chain ID 5888)
  5888: "0x1Ab18aE7386043738B0507D695832893657603B0",
};

export function getSedaCoreAddress(chainId: number): string {
  const addr = SEDA_CORE_ADDRESS[chainId];
  if (!addr) throw new Error(`No SEDA Core address for chain ${chainId}`);
  return addr;
}
