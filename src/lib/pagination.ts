export type PaginationItem = number | 'ellipsis';

export function getPaginationItems(
  currentPage: number,
  totalPages: number,
  maxVisible = 5,
): PaginationItem[] {
  const pageCount = Math.max(0, Math.floor(totalPages));
  if (pageCount === 0) return [];

  const page = Math.min(pageCount, Math.max(1, Math.floor(currentPage)));
  const visibleCount = Math.max(1, Math.floor(maxVisible));
  if (pageCount <= visibleCount)
    return Array.from({ length: pageCount }, (_, index) => index + 1);

  const halfWindow = Math.floor(visibleCount / 2);
  let start = Math.max(1, page - halfWindow);
  const end = Math.min(pageCount, start + visibleCount - 1);

  if (end - start < visibleCount - 1)
    start = Math.max(1, end - visibleCount + 1);

  const items: PaginationItem[] = [];
  if (start > 1) {
    items.push(1);
    if (start > 2) items.push('ellipsis');
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1)
    items.push(pageNumber);

  if (end < pageCount) {
    if (end < pageCount - 1) items.push('ellipsis');
    items.push(pageCount);
  }

  return items;
}
