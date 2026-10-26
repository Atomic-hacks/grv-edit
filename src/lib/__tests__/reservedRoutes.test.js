import { expect, it } from 'vitest';
import { isReservedCategorySlug } from '../reservedRoutes.js';
it('prevents root category links from colliding with application and static routes', () => {
  for (const path of ['shop', 'account', 'admin', 'checkout', 'api', 'assets', 'confirm-email']) expect(isReservedCategorySlug(path, null)).toBe(true);
  expect(isReservedCategorySlug('boots', null)).toBe(false);
  expect(isReservedCategorySlug('shop', 'parent-category')).toBe(false);
});
