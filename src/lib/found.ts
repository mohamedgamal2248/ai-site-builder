import { notFound } from "next/navigation";
import { HorizonError } from "./horizon";

/** Turns Horizon's 404 / 400 (bad id) into the site's not-found page; other errors go to error.tsx. */
export async function found<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof HorizonError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
