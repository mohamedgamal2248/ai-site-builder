"use client";

import { usePathname } from "next/navigation";

/**
 * The visible page path ("/blocks"), the same on the server and in the browser. On the server
 * Next reports the internal rewritten path ("/en-main/blocks"), and the Arabic copy lives at
 * "/ar/blocks"; both are reduced to "/blocks" so menus render identically during hydration.
 */
export function usePath() {
  const raw = usePathname() ?? "/";
  let p = raw.replace(/^\/(?:ar|en)-(?:main|test)(?:~|%7E)[^/]*/i, "").replace(/^\/(?:ar|en)-(?:main|test)(?=\/|$)/i, "");
  p = p.replace(/^\/ar(?=\/|$)/, "");
  return p || "/";
}
