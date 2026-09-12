# GRV Frontend Audit — Pre-Backend Contract

Read-only audit of the current frontend repo, performed before building the Prisma + Supabase backend and admin panel. No code was modified. All facts below are taken directly from the files named; ambiguities are called out rather than resolved.

Files inspected: [src/data/products.js](src/data/products.js), [src/data/brands.js](src/data/brands.js), [src/data/listing.js](src/data/listing.js), [src/data/navigation.js](src/data/navigation.js), [src/data/Journal.js](src/data/Journal.js), [src/api/routes.js](src/api/routes.js), [src/App.jsx](src/App.jsx), [src/ProductDetail.jsx](src/ProductDetail.jsx), [src/shop/Shop.jsx](src/shop/Shop.jsx), [src/shop/NewArrivals.jsx](src/shop/NewArrivals.jsx), [src/catalog/Catalogues.jsx](src/catalog/Catalogues.jsx), [src/catalog/GenderCatalogue.jsx](src/catalog/GenderCatalogue.jsx), [src/brands/Brands.jsx](src/brands/Brands.jsx), [src/brands/BrandCatalogue.jsx](src/brands/BrandCatalogue.jsx), [src/brand/Brand.jsx](src/brand/Brand.jsx), [src/component/layout/Navbar.jsx](src/component/layout/Navbar.jsx), [src/component/layout/Footer.tsx](src/component/layout/Footer.tsx), [src/component/cart/CartDrawer.jsx](src/component/cart/CartDrawer.jsx), [src/context/CartContext.jsx](src/context/CartContext.jsx), [src/component/ui/FilterDrawer.jsx](src/component/ui/FilterDrawer.jsx), [src/component/ui/Card.jsx](src/component/ui/Card.jsx), [prisma/schema.prisma](prisma/schema.prisma), [package.json](package.json).

---

## 1. Current data model (as-is)

### 1.1 Entities and their fields

**Product** (defined inline as plain object literals in [src/data/products.js](src/data/products.js)):

| Field         | Type (as used)                                                 | Notes                                                                                                                                                                                                                                                                              |
| ------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | string, e.g. `"prd-001"`                                       | Sequential, hand-authored, not a UUID                                                                                                                                                                                                                                              |
| `name`        | string                                                         |                                                                                                                                                                                                                                                                                    |
| `brandId`     | string                                                         | FK to `Brand.id`                                                                                                                                                                                                                                                                   |
| `gender`      | string enum: `"men"` \| `"women"` \| `"unisex"`                | No `"kids"` value appears anywhere in mock data, though `prisma/schema.prisma` already defines a `kids` enum value (see §6 discrepancy)                                                                                                                                            |
| `categoryId`  | **single** string                                              | FK to `Category.id` — a product belongs to exactly one category (see §1.4)                                                                                                                                                                                                         |
| `subcategory` | string (free text, e.g. `"Shorts"`, `"Sneakers"`, `"Jerseys"`) | Not a separate entity/table — it's a plain string on the product, only loosely governed by [src/data/navigation.js](src/data/navigation.js)'s `styles` arrays (no enforced relationship; nothing validates that a product's `subcategory` matches its `categoryId`'s allowed list) |
| `styleTags`   | array of strings, e.g. `["Casual"]`                            | Every product in the mock data has **exactly one** entry despite being an array; `Category.styleTags` (see below) defines the allowed vocabulary per category, but again nothing enforces membership                                                                               |
| `description` | string                                                         |                                                                                                                                                                                                                                                                                    |
| `basePrice`   | number                                                         | Used as a single flat price for the whole product; no per-variant pricing                                                                                                                                                                                                          |
| `isNew`       | boolean                                                        | Drives "New Arrivals" everywhere                                                                                                                                                                                                                                                   |
| `variants`    | array of Variant objects                                       | See below                                                                                                                                                                                                                                                                          |

**Variant** (built via the `variant(id, color, size, sku, images)` helper in [src/data/products.js](src/data/products.js)):

| Field    | Type                           | Notes                                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`     | string, e.g. `"prd-001-black"` | `${productId}-${colorSlug}` convention, not enforced programmatically                                                                                                                                                                                                                                            |
| `color`  | string                         |                                                                                                                                                                                                                                                                                                                  |
| `size`   | string                         | Free text — mixes clothing sizes (`"M"`, `"S"`), shoe sizes (`"9"`, `"10"`), and `"One Size"`                                                                                                                                                                                                                    |
| `sku`    | string                         | See §1.3                                                                                                                                                                                                                                                                                                         |
| `images` | array of strings (paths)       | **Every product in the mock data has exactly one variant** — no product currently has two variants, so "images per variant vs. shared images" is untested in practice; the data shape supports per-variant images, but there's no real multi-variant product to confirm size/color combinations render correctly |

**Category** ([src/data/products.js](src/data/products.js)):

```js
{ id, name, styleTags: [string] }
```

Four categories exist: `footwear`, `accessories`, `athletics`, `apparel`. `styleTags` here is the _allowed vocabulary_ for that category (used by `getFilterValues` in [src/data/listing.js](src/data/listing.js)), not the tags on any specific product.

**Brand** ([src/data/products.js](src/data/products.js), re-exported unchanged by [src/data/brands.js](src/data/brands.js)):

```js
{
  (id, name, slug, logo, description);
}
```

`id` and `slug` are identical strings for every brand in the mock data (e.g. `id: "prada"`, `slug: "prada"`) — nothing currently forces or tests this equality; `getBrandById` in products.js accepts either.

**Journal Article** ([src/data/Journal.js](src/data/Journal.js)):

```js
{ id: number, slug, title, date: string (e.g. "04.01.2025"), image, alt, size?: "large"|"small", excerpt, body: string[] }
```

`date` is a free-text string, not an ISO date. `size` is optional and only present on 2 of 6 articles (used to compute `featuredArticles`).

**Moods / Styles / Occasions / Weather**: **These entities do not exist anywhere in the codebase.** There is no mock data file, field, or filter for "mood," "occasion," or "weather." The closest concept is `styleTags` on `Category`/`Product` (values like `Casual`, `Formal`, `Outerwear`, `Athletic`, `Everyday`, `Wedding`). Any assumption that mood/occasion/weather already exist in the frontend is **incorrect** — these would be new concepts if the backend needs them.

### 1.2 Cart line item shape (runtime-only, not persisted)

[src/context/CartContext.jsx](src/context/CartContext.jsx) stores cart items as `{ id, qty, product }` where `product` is whatever caller passed in. Callers construct this ad hoc at each call site (`ProductDetail.jsx`, `NewArrivals.jsx`, `GenderCatalogue.jsx`, `BrandCatalogue.jsx`) as:

```js
{ ...product, price: product.basePrice, image: images[0], hoverImage: images[1] || images[0] }
```

So the cart item duplicates the entire product plus derived `price`/`image`/`hoverImage` fields that don't exist on the canonical `Product` shape. **No variant/size/color is ever recorded on the cart line item** — `addToCart` is called with the base product only; the currently-selected variant on the product detail page is never passed into the cart payload. This means today, adding "Classic Shorts" to cart from `ProductDetail.jsx` does not record which color/size the shopper picked.

### 1.3 `designCode` / SKU structure

There is **no field literally named `designCode`** anywhere in the codebase. The closest match is `Variant.sku`. The task description's example format (`DNZ-SH-001`) does not appear verbatim; actual SKUs follow an inconsistent pattern:

- Most SKUs: `{BRAND_PREFIX}-{TYPE_ABBREV}-{COLOR_ABBREV}`, e.g. `NL-SHORT-BK`, `AZ-SWEAT-GY`, `CF-DENIM-BL`, `PRA-TOTE-BK`.
- Two SKUs break this pattern and use a sequential number instead of a color code: `NL-BOOT-001` (Match Boot, prd-021) and coincidentally `NL-BOOT-BR` also exists for a _different_ product (Trail Seven, prd-012) — i.e. two different products both use an `NL-BOOT-*` prefix, one color-coded, one number-coded, with no consistent rule for when to use which.
- SKUs are hand-typed literals in the mock data, not generated by any function. There is no code that derives a SKU from brand/category/sequence.

**This is ambiguous and should be flagged explicitly**: the backend cannot infer a single deterministic SKU-generation rule from current data; the pattern is a loose convention, not a validated format, and at least one collision-prone naming choice (`NL-BOOT-*` reused for two products) already exists.

### 1.4 Multi-category membership

**Products do not support multi-category membership today.** Every product has a single `categoryId` (string, not array). Filtering by category anywhere in the UI ([src/catalog/GenderCatalogue.jsx](src/catalog/GenderCatalogue.jsx), [src/data/listing.js](src/data/listing.js), [src/api/routes.js](src/api/routes.js)) uses strict equality against this single field. The `/lifestyle` route and its nav entry are the closest thing to cross-cutting membership, but it's implemented as a `styleTag` filter (`"Casual"`), not a second category — i.e. "Lifestyle" is not a real category a product belongs to, it's a query filter over the `apparel`-tagged-`Casual` slice of the same single-category data.

If the backend needs true multi-category membership (e.g. a product appearing under both "Footwear" and "Athletics"), **this does not exist in the frontend today and would be a new capability**, not a reflection of existing behavior.

### 1.5 Inconsistencies between files/components for "the same" entity

- **Category filtering logic differs by page.** [src/catalog/NewArrivals.jsx](src/shop/NewArrivals.jsx) and [src/brands/BrandCatalogue.jsx](src/brands/BrandCatalogue.jsx) both fetch a base list via `getProducts(...)` and then apply UI filters client-side via `filterProducts(baseProducts, appliedFilters)` from [src/data/listing.js](src/data/listing.js). [src/catalog/GenderCatalogue.jsx](src/catalog/GenderCatalogue.jsx), by contrast, does **not** use `filterProducts` on `appliedFilters` at all for its visible product list — it recomputes `visibleProducts` directly from URL search params via `getProducts({...})`, and keeps a separate `appliedFilters` state purely for display/count purposes in the `FilterDrawer`. These are two different filtering architectures for what the UI presents as the same "filter" feature.
- **Multi-select filters are silently truncated on `GenderCatalogue`.** [src/component/ui/FilterDrawer.jsx](src/component/ui/FilterDrawer.jsx) renders checkboxes and allows multiple values to be checked per group. But `GenderCatalogue.applyFilters` only writes a URL param when a given filter group has **exactly one** selected value (`if (filters.categoryId.length === 1) ...`). If a shopper checks two subcategories, neither is applied and the drawer's "N products match" preview count (computed via `filterProducts`, which does support multi-select) will not match what's actually shown after closing the drawer. This is a real, currently-shippable UI bug, not just a data-shape footnote.
- **`Shop.jsx` uses hand-authored department/collection/brand arrays that don't come from `src/data/*` at all.** [src/shop/Shop.jsx](src/shop/Shop.jsx) defines its own local `departments`, `collections`, and `brands` arrays with hardcoded image paths, names, and links — none of it is sourced from `src/data/products.js` or `src/data/brands.js`. Its `brands` list (`Northline`, `Atelier Zero`, `Common Form`) happens to overlap with real brand IDs in `products.js`, but the images/copy are independently maintained and will drift from the real `Brand` records once a DB exists. `Catalogues.jsx`, by contrast, does import real `brands`/`getProducts` for its "New Arrivals" section but still hardcodes its own `departments` array with different images than `Shop.jsx` uses for the same department names (e.g. "Men" is `/img/maleheromodel.jpg` in both, but "Accessories" is `/img/bag1.jpg` in both — partial overlap, not a full match — while `/lifestyle` and `/footwear` differ in presence between the two files' department lists).
- **`navigationDepartments` items don't have a `.label` field**, but [src/component/layout/Navbar.jsx](src/component/layout/Navbar.jsx) reads `department.label || department.name` — dead fallback code, harmless today only because `label` is never set.
- **Brand `id` vs `slug`**: identical today, but `getBrandById` accepts either interchangeably (`brand.id === idOrSlug || brand.slug === idOrSlug`) and route params sometimes pass what's labeled `slug` (`/brands/:slug`) with a value that is actually the `id` (e.g. link `to={`/brands/${brand.id}`}` in `Brands.jsx`). If `id` and `slug` are ever allowed to diverge in the DB, this lookup ambiguity needs a decision (look up by slug only, or keep dual lookup).

---

## 2. Data consumption map

| Component/File                                                         | Data expected                                                                                                                           | Source                                                                                                         | Fields used that don't exist upstream                                                                                                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/shop/Shop.jsx](src/shop/Shop.jsx)                                 | `getProducts()` filtered by `isNew`; local hardcoded `departments`/`collections`/`brands` arrays                                        | `src/data/products.js` for the New Arrivals carousel only; everything else is inline literals in the component | Reads `product.variants[0]?.images[0]` — fine today since every product has exactly one variant, but this silently assumes variant 0 is representative; will break if a product's first variant isn't the "hero" one |
| [src/shop/NewArrivals.jsx](src/shop/NewArrivals.jsx)                   | Product list filtered by `isNew`, filterable via `filterProducts`                                                                       | `src/data/products.js`, `src/data/listing.js`                                                                  | None found                                                                                                                                                                                                           |
| [src/catalog/Catalogues.jsx](src/catalog/Catalogues.jsx)               | Product list filtered by `isNew`; hardcoded `departments` array                                                                         | `src/data/products.js`, `src/data/brands.js` (brands imported but grep shows only used indirectly)             | None found                                                                                                                                                                                                           |
| [src/catalog/GenderCatalogue.jsx](src/catalog/GenderCatalogue.jsx)     | `categories` (for style tag lookup), `getProducts` filtered by gender/category/subcategory/styleTag                                     | `src/data/products.js`, `src/data/listing.js` (`emptyFilters` only — does not use `filterProducts`)            | None found, but see §1.5 filter-truncation bug                                                                                                                                                                       |
| [src/brands/Brands.jsx](src/brands/Brands.jsx)                         | `brands` list with `logo`, `description`                                                                                                | `src/data/brands.js` → re-exported from `products.js`                                                          | None found                                                                                                                                                                                                           |
| [src/brands/BrandCatalogue.jsx](src/brands/BrandCatalogue.jsx)         | Single brand by slug/id; its products, filterable                                                                                       | `src/data/products.js`, `src/data/listing.js`                                                                  | None found                                                                                                                                                                                                           |
| [src/brand/Brand.jsx](src/brand/Brand.jsx) ("Who We Are")              | None — fully static marketing copy, plus a hardcoded `spotlightBrands` array duplicating brand name/path/image already in `products.js` | Inline literals only                                                                                           | N/A — this page has zero live data dependency today                                                                                                                                                                  |
| [src/ProductDetail.jsx](src/ProductDetail.jsx)                         | Single product by id; its variants; other products in same category                                                                     | `src/data/products.js` (`getProductById`, `getProductImages`, `getProducts`)                                   | Builds `cartProduct` with `price`/`image`/`hoverImage` fields not present on `Product` — see §1.2. Also never includes the selected variant's `id`/`sku`/`color`/`size` in the cart payload                          |
| [src/component/layout/Navbar.jsx](src/component/layout/Navbar.jsx)     | `navigationDepartments`, `searchProducts`, `getBrandById`                                                                               | `src/data/navigation.js`, `src/data/products.js`                                                               | Reads `department.label` (doesn't exist, see §1.5); links to `/account` which has no route (see §4)                                                                                                                  |
| [src/component/cart/CartDrawer.jsx](src/component/cart/CartDrawer.jsx) | `cartItems` (runtime cart state only), `subtotal`                                                                                       | `src/context/CartContext.jsx`                                                                                  | "Checkout" button has no `onClick` — purely decorative today                                                                                                                                                         |
| [src/component/ui/FilterDrawer.jsx](src/component/ui/FilterDrawer.jsx) | `products` array, `filterGroups`, `getFilterValues`                                                                                     | `src/data/listing.js`                                                                                          | None found                                                                                                                                                                                                           |
| [src/api/routes.js](src/api/routes.js)                                 | `brands`, `getProducts`                                                                                                                 | `src/data/brands.js`, `src/data/products.js`                                                                   | None found                                                                                                                                                                                                           |

---

## 3. Existing API route groundwork

All routing lives in a single in-memory handler, not a server framework: [src/api/routes.js](src/api/routes.js) exports `handleApiRequest(request)`, which pattern-matches on `url.pathname` against a `Request`-like object. **There is no evidence this is wired into any actual HTTP server** (no Express/Fastify/Vite server middleware reference found in the repo) — it reads as a stub meant to simulate what real API routes will look like, not a running route table.

| Route              | Method | Current return shape                                                                                                                                                                                                               | Intended real-DB behavior                                                                        |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/api/brands`      | GET    | Full `brands` array (all fields, unfiltered, unpaginated) verbatim from `src/data/brands.js`                                                                                                                                       | Query `Brand` table, likely paginated                                                            |
| `/api/products`    | GET    | `getProducts({ gender, categoryId, subcategory, styleTag, brandId, query })` — array of full `Product` objects (including nested `variants`) filtered from query params `gender`, `category`, `subcategory`, `style`, `brand`, `q` | Query `Product` table with joins to `Brand`/`Category`/`Variant`, filtered/paginated server-side |
| Any other path     | GET    | `{ error: "Not found" }`, 404                                                                                                                                                                                                      | —                                                                                                |
| Any non-GET method | any    | `{ error: "Method not allowed" }`, 405                                                                                                                                                                                             | Will need POST/PUT/DELETE for admin CRUD (none scaffolded yet)                                   |

**No route serving stale/duplicate demo data across multiple nav paths was found in `src/api/routes.js` itself** — only two routes exist total, and neither duplicates the other. The "routing conflict risk" mentioned in the task likely refers to the page-level duplication described in §1.5 (`Shop.jsx` vs `Catalogues.jsx` maintaining separate hardcoded department/brand data that both link to the same real routes like `/men`, `/brands`) rather than an actual `/api/*` route collision. Flagging this as the closest match rather than silently agreeing that an API-level duplicate route exists.

---

## 4. Auth & account touchpoints

- **Waitlist / sold-out products**: **Does not exist.** No `soldOut`, `inStock`, `stock`, `quantity`, or "waitlist" field, component, or copy was found anywhere in `src/`. Every product in the mock data is implicitly always purchasable. If a waitlist-for-sold-out-items feature was flagged previously, it has not yet been scaffolded in this repo in any form (no dead component, no commented-out UI, no stub field).
- **Account/profile**: A `/account` link exists in two places in [src/component/layout/Navbar.jsx](src/component/layout/Navbar.jsx) (desktop nav and mobile drawer nav), but **no `/account` route is registered** in [src/App.jsx](src/App.jsx). Clicking it today would either fall through to no matching `<Route>` (blank render, since there's no catch-all/404 route either) or 404 depending on the router's default behavior. There is no login, signup, session, token, or user-state code anywhere in `src/` (confirmed via repo-wide search).
- **Admin-only routes/pages**: **None exist.** No `/admin` path in `App.jsx`, no `admin` directory under `src/`, no role/permission check anywhere in the codebase.
- **Cart/checkout**: [src/context/CartContext.jsx](src/context/CartContext.jsx) is pure client-side `useReducer` state — no persistence, no user association, no API calls. The "Checkout" button in [src/component/cart/CartDrawer.jsx](src/component/cart/CartDrawer.jsx) is a plain `<button>` with **no `onClick` handler at all** — it does not assume a logged-in session because it does not do anything yet.

**Summary**: the frontend currently has zero functional or even stubbed auth/account/admin surface. The only auth-adjacent artifact is the dangling `/account` nav link.

---

## 5. Admin panel current state

**No admin panel exists in this repository in any form.** There is no `admin` directory, no admin route in `App.jsx`, no admin-only component, and no reference to "admin" as a role or path anywhere in `src/` (confirmed via repo-wide grep — the only "admin"-adjacent hits in the whole repo are unrelated `pnpm-lock.yaml`/`package-lock.json` entries for an AWS SDK package name).

Regarding the specific previously-flagged gaps the task asked to confirm:

- **Order management**: N/A — there is no order concept anywhere (no `Order` model, no order history UI, no checkout flow that would produce one).
- **Category/brand/mood/style/occasion/weather CRUD**: N/A — none of these have any CRUD UI. Categories, brands, and style tags are all hardcoded exports in `src/data/products.js`/`src/data/navigation.js`; there's no UI to add/edit/remove any of them. Mood/occasion/weather don't exist as entities at all (§1.1).
- **Hardcoded `heroImages` map**: **Not found.** No variable, object, or map named `heroImages` (or similar) exists anywhere in `src/`. Hero/banner images are hardcoded as individual `src="/img/..."` string literals scattered across `Shop.jsx`, `Catalogues.jsx`, `Brand.jsx`, etc. (per-section, not a centralized map). If a `heroImages` map was flagged in an earlier review, it is either already removed or was describing this scattered-literal pattern loosely — worth clarifying with whoever raised it originally.
- **Variant picker limitations**: Confirmed, and worse than "limited" — it's effectively non-functional beyond color display. In [src/ProductDetail.jsx](src/ProductDetail.jsx), the variant selector renders one button per variant labeled only with `variant.color` (size is never selectable in the UI, only shown as read-only text: `Size: {selectedVariant.size}`). Since every mock product has exactly one variant, this has never been exercised with real multi-color/multi-size data, so a product with two variants sharing the same color but different sizes would render two visually-identical buttons with no way to distinguish them.

**Conclusion**: section 5 of the requested report is effectively "there is nothing to document" — the admin panel has not been started, not even as placeholder pages. This should be treated as a from-scratch build, not a completion of existing scaffolding.

---

## 6. Proposed Prisma schema (draft)

A schema already exists at [prisma/schema.prisma](prisma/schema.prisma) and is **notably ahead of the actual frontend data model** in some respects (it already models `Brand`, `Category`, `CategoryStyleTag`, `Product`, `Variant` relationally with a many-to-many `styleTags` join). Below is a diff-style proposal: what to keep, what to change, and what's net-new, based strictly on what §1–§5 found in the frontend — not on assumptions.

### Keep as-is (already matches frontend reality)

- `Brand`, `Category` — direct match.
- `Product.gender`, `.subcategory`, `.description`, `.basePrice`, `.isNew`, `.brandId` — direct match.
- `Variant.color`, `.size`, `.sku`, `.images` (as a string array) — direct match, though see the SKU flag below.

### Flag: existing schema already diverges from frontend, needs a decision

- **`Gender` enum includes `kids`**, which never appears in any mock product. Either the frontend is missing a `kids` gender that's planned, or the enum should be trimmed to `men | women | unisex` to match reality. Needs a product decision, not silently resolved here.
- **`CategoryStyleTag` is a proper many-to-many join** in the existing schema, but every mock product only ever has a single style tag despite the frontend modeling `styleTags` as an array. The relational schema is actually _more correct_ than the frontend's current usage — worth confirming the frontend will actually start using multiple tags per product, otherwise this join table is unused complexity for now.
- **`Product.categoryId` is single (`String`, one relation)** in the existing schema, matching the frontend's current single-category-per-product reality (§1.4). If true multi-category membership is wanted going forward, this needs to become a many-to-many join table (e.g. `ProductCategory`), which is a schema change beyond what the current frontend requires but may be desired for the admin panel's future flexibility.
- **`Variant.sku` is `@unique`** in the existing schema — but the mock data already has two products reusing an `NL-BOOT-*` prefix inconsistently (§1.3, not an exact duplicate SKU, but a naming collision risk). No actual duplicate SKU string exists in the mock data today, so `@unique` is safe to keep, but the SKU-generation convention itself is not consistent enough to codify as a generated/computed field — recommend keeping `sku` as a plain unique string input for now rather than trying to derive it from brand+category+sequence.

### Net-new models needed (nothing in the frontend today; based on task requirements, not frontend evidence)

```prisma
enum Role {
  customer
  admin
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  role          Role      @default(customer)
  createdAt     DateTime  @default(now())
  waitlists     WaitlistEntry[]
  orders        Order[]
}

model WaitlistEntry {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  variantId  String
  variant    Variant  @relation(fields: [variantId], references: [id])
  createdAt  DateTime @default(now())

  @@unique([userId, variantId])
}

model Order {
  id         String      @id @default(cuid())
  userId     String
  user       User        @relation(fields: [userId], references: [id])
  items      OrderItem[]
  subtotal   Float
  status     String      @default("pending")
  createdAt  DateTime    @default(now())
}

model OrderItem {
  id         String   @id @default(cuid())
  orderId    String
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId  String
  variant    Variant  @relation(fields: [variantId], references: [id])
  qty        Int
  unitPrice  Float
}
```

**Why net-new, explicitly**: §4 and §5 confirmed there is no user, session, order, or waitlist concept anywhere in the current frontend — these models are proposed purely to satisfy the task's requirement to support users/roles/waitlist, not because any frontend evidence dictated their shape. The `Order`/`OrderItem` shape in particular is a best-guess based on the cart's current `{ id, qty, product }` runtime shape (§1.2), since checkout has no implementation to model against.

### Variant stock/inventory

Not present in the frontend at all (§1, §5). If the admin panel needs to manage stock per variant, `Variant` would need a new `stock: Int` (or a separate `Inventory` model if stock needs to be tracked per-warehouse/location — no evidence either way in the frontend, flagging as an open question).

### Categories/brands/moods/styles/occasions/weather as manageable entities

- `Brand` and `Category` are already modeled as real tables in `prisma/schema.prisma` — good, this satisfies "manageable, not hardcoded" for those two.
- `styleTags` already has `CategoryStyleTag` as a manageable join in the existing schema.
- **Mood, occasion, and weather have no frontend precedent at all** (§1.1). Proposing table shapes for them here would be pure invention with zero grounding in current code — recommend treating these as a _new feature spec_ to be defined with product/design before schema work, rather than reverse-engineering a shape from a frontend that doesn't have them.

### Summary of what's awkward to model relationally as-is

1. **SKU generation** — no deterministic rule exists; must remain a free-text unique input, not a computed field, until a real convention is defined (§1.3).
2. **Single-variant products with array-shaped `styleTags`/`variants` fields that are never actually exercised beyond length 1** — the relational schema (already more normalized than the frontend) will work, but multi-variant and multi-style-tag UI paths (variant picker, style filters) are effectively untested against real multi-value data and may reveal bugs once real data has >1 variant or >1 style tag per product (§1.1, §5).
3. **Category is single-valued today; multi-category membership does not exist** — decide now whether to keep `Product.categoryId` single (matches frontend) or move to a join table (matches the task's stated goal but requires a frontend filtering rewrite in `GenderCatalogue.jsx`/`listing.js`, which currently assume one category per product throughout, e.g. `product.categoryId !== categoryId` strict equality in `getProducts`).
4. **Cart/order line items need a variant reference that the frontend doesn't currently send** — `addToCart` calls today never include the selected variant (§1.2); the admin/order schema can still model `OrderItem.variantId` correctly, but the frontend's `ProductDetail.jsx`/`CartContext.jsx` will need changes (out of scope for this read-only audit, flagged for follow-up) before real orders can record which variant was purchased.
