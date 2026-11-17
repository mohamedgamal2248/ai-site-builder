"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/** One browser-side data cache for the whole visit: shared between pages, deduplicated, kept 10 minutes. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { gcTime: 10 * 60_000, retry: 1, refetchOnWindowFocus: true } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
