import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SidePanel from "./SidePanel";
import { buildCategoryTree, getCategoryHref, getCategoryPath } from "../../lib/categoryTree";

const formatValue = (value) =>
  String(value)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

// "View All" — a navigator, not a filter. Opens from the left (the
// opposite edge to Filter) because it moves you somewhere else rather than
// narrowing what you're already looking at. Walks the category tree to
// whatever depth it actually has (Men > Accessories > Jewelry, or deeper),
// and — for whichever category is currently active — shows the style tags
// that actually appear on products in it, computed from the live
// catalogue rather than curated by hand.
const BrowseDrawer = ({
  isOpen,
  onClose,
  categories = [],
  activeCategoryId,
  styleOptions = [],
}) => {
  const navigate = useNavigate();
  const navTree = buildCategoryTree(categories).filter((major) => major.showInNav);
  const [expandedIds, setExpandedIds] = useState(
    () => new Set(getCategoryPath(categories, activeCategoryId).map((c) => c.id)),
  );

  useEffect(() => {
    if (!isOpen) return;
    setExpandedIds(new Set(getCategoryPath(categories, activeCategoryId).map((c) => c.id)));
    // Only re-sync when the drawer opens or the viewed category changes —
    // not on every categories refetch, which would collapse manual expands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeCategoryId]);

  const toggle = (id) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const go = (id) => {
    navigate(getCategoryHref(categories, id));
    onClose();
  };

  const goToStyle = (id, styleValue) => {
    navigate(`${getCategoryHref(categories, id)}?style=${encodeURIComponent(styleValue)}`);
    onClose();
  };

  const renderNode = (node, depth) => {
    const isExpanded = expandedIds.has(node.id);
    const isCurrent = node.id === activeCategoryId;
    const hasChildren = node.children.length > 0;
    return (
      <div key={node.id} className={depth === 0 ? "border-b border-[var(--line)]" : ""}>
        <div
          className="flex w-full items-center justify-between py-3"
          style={{ paddingLeft: depth * 14 }}
        >
          <button
            type="button"
            onClick={() => go(node.id)}
            className={
              depth === 0
                ? `text-[13px] font-semibold uppercase tracking-[0.1em] ${
                    isCurrent ? "text-(--color-accent-orange)" : "text-[var(--ink-900)]"
                  }`
                : `text-[13px] ${
                    isCurrent
                      ? "font-semibold text-(--color-accent-orange)"
                      : "text-[var(--ink-700)] hover:text-[var(--ink-900)]"
                  }`
            }
          >
            {node.name}
          </button>
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              aria-expanded={isExpanded}
              aria-label={`Toggle ${node.name}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className={isExpanded ? "rotate-180" : ""}>
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
          )}
        </div>

        {isCurrent && styleOptions.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-3" style={{ paddingLeft: (depth + 1) * 14 }}>
            {styleOptions.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => goToStyle(node.id, style.value)}
                className="border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--ink-700)] transition-colors hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
              >
                {formatValue(style.label)}
              </button>
            ))}
          </div>
        )}

        {isExpanded && hasChildren && (
          <div className="pb-2">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <SidePanel isOpen={isOpen} onClose={onClose} side="left" title="Browse">
      <div className="py-2">{navTree.map((major) => renderNode(major, 0))}</div>
    </SidePanel>
  );
};

export default BrowseDrawer;
