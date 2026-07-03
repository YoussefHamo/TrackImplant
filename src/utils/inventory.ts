export interface HasDisplayName {
  name?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  size?: string | null;
  category?: string | null;
}

export function getItemDisplayName(item: HasDisplayName | null | undefined): string {
  if (!item) return '';
  // If name is already set (inventory_items, product catalog), use it directly
  if (item.name) return item.name;
  // Fallback chain: subcategory → brand + size → brand → size → category
  if (item.subcategory) return item.subcategory;
  if (item.brand || item.size) return `${item.brand || ''} ${item.size || ''}`.trim();
  return item.category || '';
}
