// Length caps for free-text written by the public.
//
// Every string column in the schema is an unbounded Postgres `text`, and the
// open endpoints only checked that a field was non-empty. One request could
// therefore store as much text as the platform would carry (Vercel caps a
// body at ~4.5MB), repeatedly — filling the database and the admin screens
// with no upper bound, at our cost.
//
// These are generous enough that no honest submission hits them.
export const LIMITS = {
  name: 120,
  email: 254, // RFC 5321 maximum
  subject: 200,
  message: 5000,
  phone: 32,
  address: 300,
  city: 100,
  state: 100,
  postalCode: 20,
  country: 100,
  fullName: 120,
};

/**
 * Validates and trims a set of required string fields in one pass.
 * Returns { error } on the first problem, or { data } with trimmed values.
 */
export const validateTextFields = (body, fields) => {
  const data = {};
  const missing = [];

  for (const field of fields) {
    const value = body?.[field];
    if (typeof value !== "string" || !value.trim()) {
      missing.push(field);
      continue;
    }
    const trimmed = value.trim();
    const max = LIMITS[field];
    if (max && trimmed.length > max) {
      return {
        error: `${field} must be ${max} characters or fewer`,
      };
    }
    data[field] = trimmed;
  }

  if (missing.length) {
    return {
      error: `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`,
    };
  }
  return { data };
};
