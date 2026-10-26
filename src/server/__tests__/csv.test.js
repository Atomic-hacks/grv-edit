import { expect, it } from "vitest";
import { csvCell } from "../csv.js";
it("neutralizes formula-like customer data, including leading whitespace", () => {
  for (const cell of ['=1+1', '+123', '-1+2', '@SUM(A1)', ' \t=1', '\t123']) expect(csvCell(cell)).toMatch(/^'/);
  expect(csvCell('=HYPERLINK("https://evil.test","Click")')).toBe('"\'=HYPERLINK(""https://evil.test"",""Click"")"');
  expect(csvCell(-10)).toBe('-10');
  expect(csvCell('Normal, "name"')).toBe('"Normal, ""name"""');
});
