import { createHash, randomInt } from "node:crypto";

// Short, human-friendly reference shown to the customer and used in the
// acknowledgement email/support conversations — "GRV-3F9K2Q" rather than a
// raw cuid. Collisions are astronomically unlikely at this volume, and the
// caller retries on the rare unique-constraint violation same as SKU
// generation elsewhere in this codebase.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export const generateCaseReference = () => {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return `GRV-${code}`;
};

// Fingerprint of "the same complaint" — stops a double form-submit or a
// network retry from creating two cases for the same order + issue, without
// having to guess at a time window. Two genuinely different complaints
// about the same order (different issue type, or materially different
// description) still get through.
export const buildCaseDedupeKey = ({
  userId,
  orderId,
  issueType,
  description,
}) => {
  const normalizedDescription = String(description || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return createHash("sha256")
    .update(`${userId}|${orderId || ""}|${issueType}|${normalizedDescription}`)
    .digest("hex");
};
