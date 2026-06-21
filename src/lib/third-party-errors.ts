/** True when an error message likely comes from a browser wallet extension, not Qup. */
export function isWalletExtensionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("ethereum") ||
    lower.includes("metamask") ||
    lower.includes("selectedaddress") ||
    lower.includes("web3") ||
    lower.includes("walletconnect")
  );
}
