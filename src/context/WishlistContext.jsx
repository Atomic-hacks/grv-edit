import React, { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const wishlistQuery = useQuery({
    queryKey: ["wishlist", user?.id],
    queryFn: () => createAuthenticatedRequest(session)("/api/wishlist"),
    enabled: Boolean(user && session),
  });
  const items = wishlistQuery.data || [];
  const loading = wishlistQuery.isPending;

  const isWishlisted = (productId) =>
    items.some((item) => item.productId === productId);

  const toggleWishlist = async (product) => {
    if (!session) return;
    const saved = isWishlisted(product.id);
    if (saved) {
      await createAuthenticatedRequest(session)(
        `/api/wishlist/${encodeURIComponent(product.id)}`,
        { method: "DELETE" },
      );
      await queryClient.invalidateQueries({
        queryKey: ["wishlist", user.id],
      });
      return;
    }

    const result = await createAuthenticatedRequest(session)("/api/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId: product.id }),
    });
    queryClient.setQueryData(["wishlist", user.id], (current = []) => [
      ...current,
      { ...result.wishlist, productId: product.id, product },
    ]);
    await queryClient.invalidateQueries({
      queryKey: ["wishlist", user.id],
    });
  };

  const isBrandWishlisted = (brandId) =>
    items.some((item) => item.brandId === brandId);

  const toggleBrandWishlist = async (brand) => {
    if (!session) return;
    const saved = isBrandWishlisted(brand.id);
    if (saved) {
      await createAuthenticatedRequest(session)(
        `/api/wishlist/brand/${encodeURIComponent(brand.id)}`,
        { method: "DELETE" },
      );
      await queryClient.invalidateQueries({
        queryKey: ["wishlist", user.id],
      });
      return;
    }

    const result = await createAuthenticatedRequest(session)("/api/wishlist", {
      method: "POST",
      body: JSON.stringify({ brandId: brand.id }),
    });
    queryClient.setQueryData(["wishlist", user.id], (current = []) => [
      ...current,
      { ...result.wishlist, brandId: brand.id, brand },
    ]);
    await queryClient.invalidateQueries({
      queryKey: ["wishlist", user.id],
    });
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        loading,
        isWishlisted,
        toggleWishlist,
        isBrandWishlisted,
        toggleBrandWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
