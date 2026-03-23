export const SEDA_CORE_ADDRESS: Record<number, string> = {
  5887: "0x1Ab18aE7386043738B0507D695832893657603B0",
};

export function getSedaCoreAddress(chainId: number): string {
  const addr = SEDA_CORE_ADDRESS[chainId];
  if (!addr) throw new Error(`No SEDA Core address for chain ${chainId}`);
  return addr;
}
