import { expect, it } from "vitest";
import { adminNavigationFor, canAccessAdminPath } from "../adminNav.js";
it("shows only authorized staff destinations and guards deep links", () => {
  expect(canAccessAdminPath('ADMIN', '/admin/staff')).toBe(false);
  expect(canAccessAdminPath('OWNER', '/admin/staff')).toBe(true);
  expect(canAccessAdminPath('SUPPORT', '/admin/customers/1')).toBe(false);
  expect(canAccessAdminPath('SUPPORT', '/admin/cases')).toBe(true);
  expect(canAccessAdminPath('FULFILMENT', '/admin/orders/1')).toBe(true);
  expect(canAccessAdminPath('ANALYST', '/admin/products/new')).toBe(false);
  expect(adminNavigationFor('ANALYST').flatMap((g) => g.items).map((i) => i.to)).toEqual(['/admin/analytics', '/admin/visitors']);
});
