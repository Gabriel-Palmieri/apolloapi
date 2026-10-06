import type { PageDto } from '../dto/page.dto.js';
export function pageWindow(total: number, query: PageDto) {
  const limit = query.limit ?? 20;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(query.page ?? 1, pages);
  return { total, page, pages, limit };
}