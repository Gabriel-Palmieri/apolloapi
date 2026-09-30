import type { PageDto } from '../dto/page.dto.js';

export function pagination(query: PageDto) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}
