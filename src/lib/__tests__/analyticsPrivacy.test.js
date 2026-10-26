import { expect, it } from "vitest";
import { analyticsPage } from "../analyticsPrivacy.js";
it("excludes private journeys and strips secrets from public locations", () => {
  for (const path of ['/unsubscribe?token=secret', '/reset-password#access_token=secret', '/checkout/complete?reference=payment', '/admin/orders', '/account']) expect(analyticsPage(path, 'https://shop.test')).toBeNull();
  expect(analyticsPage('/shop?email=private@test.local#token=secret', 'https://shop.test')).toEqual({ page_path: '/shop', page_location: 'https://shop.test/shop' });
});
