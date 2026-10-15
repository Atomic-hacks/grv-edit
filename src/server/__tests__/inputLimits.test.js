import { describe, it, expect } from "vitest";
import { validateTextFields, LIMITS } from "../inputLimits.js";

const CONTACT = ["name", "email", "subject", "message"];
const good = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Order query",
  message: "Where is my order?",
};

describe("validateTextFields", () => {
  it("accepts an ordinary submission and trims it", () => {
    const result = validateTextFields(
      { ...good, name: "  Ada Lovelace  " },
      CONTACT,
    );
    expect(result.error).toBeUndefined();
    expect(result.data.name).toBe("Ada Lovelace");
  });

  it("rejects a multi-megabyte message (storage exhaustion)", () => {
    const result = validateTextFields(
      { ...good, message: "A".repeat(4 * 1024 * 1024) },
      CONTACT,
    );
    expect(result.error).toMatch(/message must be \d+ characters or fewer/);
    expect(result.data).toBeUndefined();
  });

  it("caps every field, not just the obvious one", () => {
    for (const field of CONTACT) {
      const oversized = { ...good, [field]: "A".repeat(LIMITS[field] + 1) };
      expect(validateTextFields(oversized, CONTACT).error, field).toContain(field);
    }
  });

  it("accepts a value exactly at the limit (off-by-one guard)", () => {
    for (const field of CONTACT) {
      const atLimit = { ...good, [field]: "A".repeat(LIMITS[field]) };
      expect(validateTextFields(atLimit, CONTACT).error, field).toBeUndefined();
    }
  });

  it("still reports missing and blank fields", () => {
    expect(validateTextFields({ ...good, name: "   " }, CONTACT).error).toContain("name");
    expect(validateTextFields({}, CONTACT).error).toContain("name");
    expect(validateTextFields({}, CONTACT).error).toContain("are required");
  });

  it("rejects non-string values rather than coercing them", () => {
    for (const value of [42, null, {}, [], true]) {
      expect(validateTextFields({ ...good, name: value }, CONTACT).error, String(value))
        .toContain("name");
    }
  });

  it("caps the checkout shipping fields too", () => {
    const fields = ["fullName", "country", "phone", "address", "city", "state", "postalCode"];
    const base = {
      fullName: "Ada", country: "NG", phone: "+2348012345678",
      address: "12 Marina Road", city: "Lagos", state: "Lagos", postalCode: "100001",
    };
    expect(validateTextFields(base, fields).error).toBeUndefined();
    expect(
      validateTextFields({ ...base, address: "A".repeat(LIMITS.address + 1) }, fields).error,
    ).toContain("address");
  });
});
