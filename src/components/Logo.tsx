/**
 * The Blockchain Pi mark: an isometric block (the ledger) with a mint node at its core.
 * Our own design; deliberately unlike Pi Network's π logo.
 */
export function Logo({ size = 34, className = "logo", title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id="bp-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a63f2" />
          <stop offset="1" stopColor="#5b2fc9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#bp-logo-g)" />
      <path d="M32 13 49 22.5v19L32 51 15 41.5v-19Z" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M15 22.5 32 32l17-9.5M32 32v19" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="32" cy="32" r="4.2" fill="#3ee0b0" />
    </svg>
  );
}
