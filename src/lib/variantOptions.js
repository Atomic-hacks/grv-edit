// Products with no real options (watches, bags, other accessories) are sold
// through a single variant carrying these placeholder values — the cart,
// stock, waitlist and checkout all hang off a variant, so every buyable
// product needs one. Anywhere a customer sees color/size, placeholders are
// hidden so they never read "Default / One Size".
export const NO_OPTION_COLOR = "Default";
export const NO_OPTION_SIZE = "One Size";

const same = (a, b) =>
  String(a ?? "")
    .trim()
    .toLowerCase() === b.toLowerCase();

export const isPlaceholderColor = (color) => same(color, NO_OPTION_COLOR);
export const isPlaceholderSize = (size) => same(size, NO_OPTION_SIZE);

// "Navy / M", "Navy", "M" — or "" for a no-options variant.
export const variantLabel = (variant) =>
  [
    isPlaceholderColor(variant?.color) ? "" : variant?.color,
    isPlaceholderSize(variant?.size) ? "" : variant?.size,
  ]
    .filter(Boolean)
    .join(" / ");
