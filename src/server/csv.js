// CSV quoting does not stop spreadsheet formula execution. Prefix every
// untrusted string that could be interpreted as a formula with a literal
// apostrophe. Numbers remain typed as numbers and may legitimately be negative.
export const csvCell = (value) => {
  let cell = value == null ? "" : String(value);
  if (typeof value === "string" && (/^[=+@-]/u.test(cell.trimStart()) || [...cell].some((char) => char.charCodeAt(0) < 32))) {
    cell = `'${cell}`;
  }
  return /[",\n\r]/u.test(cell) ? `"${cell.replace(/"/gu, '""')}"` : cell;
};
