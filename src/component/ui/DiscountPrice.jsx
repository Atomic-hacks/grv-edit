import React from "react";
import { formatPrice, getDiscountedPrice } from "../../lib/productHelpers";

const ALIGNMENT = {
  end: { justify: "justify-end", text: "text-right" },
  start: { justify: "justify-start", text: "text-left" },
};

const DiscountPrice = ({
  basePrice,
  discountPercent,
  className = "",
  normalPrice,
  light = false,
  discountTone = "default",
  align = "end",
}) => {
  const hasDiscount =
    discountPercent !== null &&
    discountPercent !== undefined &&
    Number.isFinite(Number(discountPercent));

  if (!hasDiscount) {
    return <p className={className}>{normalPrice || formatPrice(basePrice)}</p>;
  }

  const alignment = ALIGNMENT[align] || ALIGNMENT.end;
  const saleTone =
    discountTone === "red"
      ? "text-neutral-900"
      : light
        ? "text-white"
        : "text-red-600";

  // Was-price, now-price and the percentage read as one line at card sizes
  // and wrap to two only when the container is genuinely narrow, instead of
  // always stacking into a three-line block beside the product name.
  return (
    <div
      className={`flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 ${alignment.justify} ${alignment.text} ${className}`}
    >
      <span className={saleTone}>
        {formatPrice(getDiscountedPrice(basePrice, discountPercent))}
      </span>
      <span
        className={`text-[11px] font-normal line-through ${
          light ? "text-white/60" : "text-red-600"
        }`}
      >
        {formatPrice(basePrice)}
      </span>
      <span className={`text-[11px] font-semibold text-red-600`}>
        -{Number(discountPercent)}%
      </span>
    </div>
  );
};

export default DiscountPrice;
