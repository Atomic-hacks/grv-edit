import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const RecentlyViewedContext = createContext(null);

const STORAGE_KEY = "grv_recently_viewed";
// Enough to fill a rail twice over without letting the list become a second,
// unmanaged wishlist.
const MAX_ITEMS = 12;

// Only the fields a product card needs are kept. Storing whole API products
// would put stale prices and stock in localStorage, where nothing would ever
// invalidate them.
const toStoredProduct = (product) => ({
  id: product.id,
  name: product.name,
  brandName: product.brandName || product.brand?.name || null,
  basePrice: product.basePrice,
  discountPercent: product.discountPercent ?? null,
  subcategory: product.subcategory || null,
  gender: product.gender || null,
  imageUrl: product.imageUrl || null,
  variants: (product.variants || []).slice(0, 1).map((variant) => ({
    id: variant.id,
    images: (variant.images || []).slice(0, 2),
  })),
});

const readStored = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id) : [];
  } catch {
    // Private browsing and blocked storage both throw here. Recently viewed
    // is a convenience, so a failure degrades to "nothing viewed yet".
    return [];
  }
};

export const RecentlyViewedProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(readStored());
  }, []);

  const recordView = useCallback((product) => {
    if (!product?.id) return;
    setItems((current) => {
      // Re-viewing a product moves it to the front rather than duplicating it.
      const next = [
        toStoredProduct(product),
        ...current.filter((item) => item.id !== product.id),
      ].slice(0, MAX_ITEMS);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Keep the in-memory list for this session even if it cannot persist.
      }
      return next;
    });
  }, []);

  const clearRecentlyViewed = useCallback(() => {
    setItems([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to do — the in-memory list is already cleared.
    }
  }, []);

  // Callers almost always want "everything except the product being looked at".
  const getRecentlyViewed = useCallback(
    (excludeId) =>
      excludeId ? items.filter((item) => item.id !== excludeId) : items,
    [items],
  );

  const value = useMemo(
    () => ({ items, recordView, getRecentlyViewed, clearRecentlyViewed }),
    [items, recordView, getRecentlyViewed, clearRecentlyViewed],
  );

  return (
    <RecentlyViewedContext.Provider value={value}>
      {children}
    </RecentlyViewedContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useRecentlyViewed = () => {
  const context = useContext(RecentlyViewedContext);
  if (!context) {
    throw new Error(
      "useRecentlyViewed must be used within a RecentlyViewedProvider",
    );
  }
  return context;
};
