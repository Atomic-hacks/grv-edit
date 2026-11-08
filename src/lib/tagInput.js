// Keep administrator-entered tags usable in URL filters.
export const normalizeTagInput = (body) => {
  const data = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) {
      return { error: "Tag name must contain 1–120 characters" };
    }
    data.name = body.name.trim();
  }
  if (body.slug !== undefined) {
    if (typeof body.slug !== "string") return { error: "Tag slug must be text" };
    data.slug = body.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!data.slug || data.slug.length > 120) return { error: "Tag slug must contain 1–120 letters, numbers or hyphens" };
  }
  return { data };
};
