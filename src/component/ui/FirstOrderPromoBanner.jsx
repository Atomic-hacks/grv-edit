import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { createAuthenticatedRequest } from "../../lib/apiClient";

const FirstOrderPromoBanner = () => {
  const { session, appUser } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [markedSeen, setMarkedSeen] = useState(false);
  const shouldCheck = Boolean(
    session &&
    appUser &&
    appUser.role === "CUSTOMER" &&
    !appUser.hasSeenFirstOrderBanner &&
    !appUser.firstOrderPromoUsed,
  );
  const promoQuery = useQuery({
    queryKey: ["first-order-promo", appUser?.id],
    queryFn: () => request("/api/account/first-order-promo"),
    enabled: shouldCheck,
  });
  const promo = promoQuery.data;

  useEffect(() => {
    if (!promo?.eligible || markedSeen) return;
    setMarkedSeen(true);
    request("/api/account/first-order-promo", { method: "POST" })
      .then(() =>
        queryClient.invalidateQueries({ queryKey: ["me", appUser.id] }),
      )
      .catch(() => setMarkedSeen(false));
  }, [appUser?.id, markedSeen, promo?.eligible, queryClient, request]);

  if (!promo?.eligible || dismissed) return null;

  return (
    <aside className="relative z-30 bg-black px-4 py-2 text-white md:px-12">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <p className="min-w-0 truncate text-xs font-medium md:text-sm">
          {promo.bannerMessage} — {promo.discountPercent}% off your first order
          {promo.freeShipping ? " · Free shipping" : ""}
        </p>
        <button
          type="button"
          aria-label="Dismiss first-order promotion"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-lg leading-none text-gray-300 hover:text-white"
        >
          ×
        </button>
      </div>
    </aside>
  );
};

export default FirstOrderPromoBanner;
