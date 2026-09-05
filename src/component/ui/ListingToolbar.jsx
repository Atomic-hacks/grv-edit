import React from "react";

const ListingToolbar = ({
  leftContent,
  onFilter,
  activeFilterCount = 0,
  onViewAll,
  label = "VIEW ALL",
}) => {
  return (
    <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
      <div className="flex items-center gap-6">
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-semibold text-black transition-colors hover:text-(--color-accent-orange)"
          >
            {label}
          </button>
        ) : null}
        {leftContent}
      </div>
      <button
        type="button"
        onClick={onFilter}
        className="text-sm font-semibold tracking-wide text-black transition-colors hover:text-(--color-accent-orange)"
      >
        FILTER{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>
    </div>
  );
};

export default ListingToolbar;
