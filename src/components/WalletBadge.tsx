import type { WalletLogo } from "@/data/wallets";

/**
 * Small identity badges. These are our own monograms in each brand's colour, not the
 * companies' official logo files.
 */
export function WalletBadge({ logo, size = 18 }: { logo: WalletLogo; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const, className: "wallet-badge" };
  switch (logo) {
    case "pi":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="12" fill="#6b3fd4" />
          <text x="12" y="17" textAnchor="middle" fontSize="15" fontWeight="700" fontFamily="Georgia, serif" fill="#f5b83d">π</text>
        </svg>
      );
    case "okx":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#111" />
          <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fontFamily="system-ui, sans-serif" fill="#fff">OKX</text>
        </svg>
      );
    case "bitget":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#00c4c4" />
          <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="system-ui, sans-serif" fill="#fff">B</text>
        </svg>
      );
    case "whale":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="12" fill="#1f6fd1" />
          <path d="M5 13.5c0 2.5 2.6 4 6.2 4 4.4 0 7.3-2.4 7.3-5.6 0-.6-.1-1-.3-1.4 1-.3 1.8-1.1 2-2.2-1 .4-1.9.3-2.6-.2-.6 1.1-1.6 1.8-2.6 2.1-1.9.5-3.9.3-6 1.1-1.1.4-2 1.2-2 2.2Z" fill="#fff" />
          <circle cx="9" cy="14" r="0.9" fill="#1f6fd1" />
        </svg>
      );
  }
}
