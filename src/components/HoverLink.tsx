"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * A link that prefetches only when the pointer or finger reaches it, instead of
 * for every link that scrolls into view. Tables have dozens of links; prefetching
 * all of them costs a server request each.
 */
export function HoverLink({ href, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();
  const warm = () => router.prefetch(href);
  return <Link href={href} prefetch={false} onMouseEnter={warm} onTouchStart={warm} onFocus={warm} {...rest} />;
}
