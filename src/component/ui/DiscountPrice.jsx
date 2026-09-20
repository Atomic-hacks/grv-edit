import React from "react";
import { formatPrice, getDiscountedPrice } from "../../lib/productHelpers";

const DiscountPrice = ({
  basePrice,
  discountPercent,
  className = "",
  normalPrice,
  light = false,
  discountTone = "default",
}) => {
  const hasDiscount =
    discountPercent !== null &&
    discountPercent !== undefined &&
    Number.isFinite(Number(discountPercent));

  if (!hasDiscount) {
    return <p className={className}>{normalPrice || formatPrice(basePrice)}</p>;
  }

  return (
    <div className={`flex min-w-0 flex-col items-end gap-0.5 ${className}`}>
      <span
        className={`text-[10px] line-through sm:text-xs ${light ? "text-white/60" : "text-neutral-500"}`}
      >
        {formatPrice(basePrice)}
      </span>
      <span
        className={`text-sm font-bold sm:text-base ${
          discountTone === "red"
            ? "text-red-600"
            : light
              ? "text-white"
              : "text-neutral-900"
        }`}
      >
        {formatPrice(getDiscountedPrice(basePrice, discountPercent))}
      </span>
      <span
        className={`text-[10px] sm:text-xs ${
          discountTone === "red"
            ? "text-red-600"
            : light
              ? "text-white/70"
              : "text-neutral-500"
        }`}
      >
        -{Number(discountPercent)}%
      </span>
    </div>
  );
};

export default DiscountPrice;
