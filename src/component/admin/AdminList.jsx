import React from "react";
import Spinner from "../ui/Spinner";
import InlineNotice from "../ui/InlineNotice";

/**
 * One list component for every admin section, rendering the same data two
 * ways: a table on desktop, stacked cards on mobile.
 *
 * The mobile case is the point. Forcing a six-column table through a phone
 * with horizontal scroll is how admin dashboards become unusable away from
 * a desk — here each row becomes a card with its primary field as a heading
 * and the rest as labelled pairs, so an order can be found and opened with
 * a thumb.
 *
 * columns: [{ key, label, render(row), className?, mobile?: "title" |
 * "meta" | "hidden" }]
 */
const AdminList = ({
  columns,
  rows,
  rowKey = (row) => row.id,
  onRowClick,
  loading = false,
  error = "",
  onRetry,
  emptyTitle = "Nothing here yet",
  emptyMessage,
  actions,
}) => {
  if (error) {
    return (
      <InlineNotice tone="error" className="mt-6">
        {error}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-2 font-semibold underline underline-offset-4"
          >
            Try again
          </button>
        )}
      </InlineNotice>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center border border-[var(--line)] py-16">
        <Spinner label="Loading" className="text-[13px] text-[var(--ink-500)]" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="border border-[var(--line)] px-6 py-16 text-center">
        <p className="section-title">{emptyTitle}</p>
        {emptyMessage && <p className="meta-text mx-auto mt-2 max-w-sm">{emptyMessage}</p>}
      </div>
    );
  }

  const titleColumn = columns.find((column) => column.mobile === "title") || columns[0];
  const mobileColumns = columns.filter(
    (column) => column !== titleColumn && column.mobile !== "hidden",
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto border-t border-[var(--ink-900)] md:block">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[var(--line)] text-[11px] uppercase tracking-[0.14em] text-[var(--ink-500)]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-3 py-3.5 font-medium ${column.className || ""}`}>
                  {column.label}
                </th>
              ))}
              {actions && <th className="px-3 py-3.5 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-[var(--line)] align-middle transition-colors hover:bg-[var(--surface-muted)] ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-3 py-3 ${column.className || ""}`}>
                    {column.render(row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`border border-[var(--line)] p-4 ${onRowClick ? "cursor-pointer active:bg-[var(--surface-muted)]" : ""}`}
          >
            <div className="text-[14px] font-semibold text-[var(--ink-900)]">
              {titleColumn.render(row)}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {mobileColumns.map((column) => (
                <div key={column.key} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-300)]">
                    {column.label}
                  </dt>
                  <dd className="mt-0.5 text-[13px] text-[var(--ink-700)]">
                    {column.render(row)}
                  </dd>
                </div>
              ))}
            </dl>
            {actions && (
              <div
                className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

export default AdminList;
