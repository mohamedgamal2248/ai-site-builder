import type { ListQuery, Page } from "./horizon";

export interface PageParams {
  cursor?: string;
  dir?: string;
}

export function readPageParams(sp: Record<string, string | string[] | undefined>): PageParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const cursor = one(sp.cursor);
  return {
    cursor: cursor && /^[0-9a-zA-Z-]{1,100}$/.test(cursor) ? cursor : undefined,
    dir: one(sp.dir) === "asc" ? "asc" : undefined,
  };
}

/**
 * Newest-first pages over a Horizon collection.
 * "Older" continues descending from the last row; "Newer" walks ascending from the first row
 * and the rows are flipped back so the page always reads newest first.
 */
export async function paged<T extends { paging_token: string }>(
  fetcher: (q: ListQuery) => Promise<Page<T>>,
  p: PageParams,
  limit = 20,
) {
  const asc = p.dir === "asc" && !!p.cursor;
  const page = await fetcher({ cursor: p.cursor, order: asc ? "asc" : "desc", limit });
  const records = asc ? [...page.records].reverse() : page.records;
  const atNewest = asc && records.length < limit;
  return {
    records,
    next: records.length && (asc || records.length === limit) ? records[records.length - 1].paging_token : undefined,
    prev: p.cursor && records.length && !atNewest ? records[0].paging_token : undefined,
  };
}
