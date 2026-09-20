import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { createAuthenticatedRequest, fetchProductById } from "../lib/apiClient";
import { getDiscountedPrice, getProductImages } from "../lib/productHelpers";
import { useToast } from "./ToastContext";

const CartContext = createContext(null);

const initialState = {
  cartItems: [],
  isCartOpen: false,
};

const getAvailableStock = (product) => {
  const variant = product?.variants?.find(
    (candidate) => candidate.id === product.variantId,
  );
  return variant?.stock ?? null;
};

const withCurrentPrice = (product) => ({
  ...product,
  price: getDiscountedPrice(product.basePrice, product.discountPercent),
});

const clampQuantity = (product, qty) => {
  const stock = getAvailableStock(product);
  return stock === null ? qty : Math.min(qty, Math.max(stock, 0));
};

const mergeCartItems = (items) => {
  const mergedItems = new Map();
  for (const item of items) {
    const existing = mergedItems.get(item.id);
    mergedItems.set(item.id, {
      ...(existing || item),
      qty: (existing?.qty || 0) + item.qty,
    });
  }
  return [...mergedItems.values()].map((item) => ({
    ...item,
    qty: clampQuantity(item.product, item.qty),
  }));
};

const cartReducer = (state, action) => {
  switch (action.type) {
    case "ADD": {
      const { product, qty } = action.payload;
      const lineId = `${product.id}:${product.variantId || "default"}`;
      const existing = state.cartItems.find((item) => item.id === lineId);
      const nextQty = clampQuantity(product, (existing?.qty || 0) + qty);
      if (nextQty <= 0) return state;
      if (existing) {
        return {
          ...state,
          cartItems: state.cartItems.map((item) =>
            item.id === lineId ? { ...item, qty: nextQty } : item,
          ),
        };
      }
      return {
        ...state,
        cartItems: [...state.cartItems, { id: lineId, qty: nextQty, product }],
      };
    }
    case "REMOVE":
      return {
        ...state,
        cartItems: state.cartItems.filter((item) => item.id !== action.payload),
      };
    case "UPDATE_QTY": {
      const { id, qty } = action.payload;
      if (qty <= 0) {
        return {
          ...state,
          cartItems: state.cartItems.filter((item) => item.id !== id),
        };
      }
      return {
        ...state,
        cartItems: state.cartItems.map((item) =>
          item.id === id
            ? { ...item, qty: clampQuantity(item.product, qty) }
            : item,
        ),
      };
    }
    case "CLEAR":
      return { ...state, cartItems: [] };
    case "HYDRATE":
      return {
        ...state,
        cartItems: mergeCartItems(action.payload).filter(
          (item) => item.qty > 0,
        ),
      };
    case "OPEN":
      return { ...state, isCartOpen: true };
    case "CLOSE":
      return { ...state, isCartOpen: false };
    case "TOGGLE":
      return { ...state, isCartOpen: !state.isCartOpen };
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const { session, user } = useAuth();
  const [cartSyncReady, setCartSyncReady] = useState(false);
  const cartItemsRef = useRef(state.cartItems);
  const skipSyncCartRef = useRef(null);
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const { showToast } = useToast();
  const accessToken = session?.access_token;

  const cartQuery = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      const persistedItems = await request("/api/cart");
      return (
        await Promise.all(
          persistedItems.map(async (item) => {
            const product = await fetchProductById(item.productId);
            if (!product) return null;

            const images = getProductImages(product, item.variantId);
            return {
              id: `${item.productId}:${item.variantId}`,
              qty: item.quantity,
              product: {
                ...product,
                variantId: item.variantId,
                price: getDiscountedPrice(
                  product.basePrice,
                  product.discountPercent,
                ),
                image: images[0],
                hoverImage: images[1] || images[0],
              },
            };
          }),
        )
      ).filter(Boolean);
    },
    enabled: Boolean(accessToken && user),
  });

  cartItemsRef.current = state.cartItems;

  useEffect(() => {
    if (!accessToken) {
      setCartSyncReady(false);
      return undefined;
    }

    setCartSyncReady(false);

    if (cartItemsRef.current.length > 0) {
      setCartSyncReady(true);
      return undefined;
    }
    if (cartQuery.isPending) return undefined;
    if (cartQuery.data && cartItemsRef.current.length === 0) {
      skipSyncCartRef.current = cartQuery.data;
      dispatch({ type: "HYDRATE", payload: cartQuery.data });
    }
    setCartSyncReady(true);
    return undefined;
  }, [accessToken, cartQuery.data, cartQuery.isPending]);

  useEffect(() => {
    if (!accessToken || !cartSyncReady) return undefined;
    if (skipSyncCartRef.current === state.cartItems) {
      return undefined;
    }
    skipSyncCartRef.current = null;

    const timeout = window.setTimeout(async () => {
      const items = cartItemsRef.current.map((item) => ({
        productId: item.product.id,
        variantId: item.product.variantId || item.product.variants?.[0]?.id,
        quantity: item.qty,
      }));

      try {
        await request("/api/cart/sync", {
          method: "POST",
          body: JSON.stringify({ items }),
        });
      } catch (error) {
        console.error("Cart sync failed", error);
      }
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [accessToken, cartSyncReady, request, state.cartItems]);

  const addToCart = (product, qty = 1) => {
    dispatch({
      type: "ADD",
      payload: { product: withCurrentPrice(product), qty },
    });
    showToast("Added to Goody Bag");
  };
  const removeFromCart = (id) => dispatch({ type: "REMOVE", payload: id });
  const updateQty = (id, qty) =>
    dispatch({ type: "UPDATE_QTY", payload: { id, qty } });
  const clearCart = () => dispatch({ type: "CLEAR" });

  const openCart = () => dispatch({ type: "OPEN" });
  const closeCart = () => dispatch({ type: "CLOSE" });
  const toggleCart = () => dispatch({ type: "TOGGLE" });

  const itemCount = useMemo(
    () => state.cartItems.reduce((total, item) => total + item.qty, 0),
    [state.cartItems],
  );

  const subtotal = useMemo(
    () =>
      state.cartItems.reduce(
        (total, item) => total + item.product.price * item.qty,
        0,
      ),
    [state.cartItems],
  );

  const value = {
    cartItems: state.cartItems,
    isCartOpen: state.isCartOpen,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    openCart,
    closeCart,
    toggleCart,
    itemCount,
    subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
