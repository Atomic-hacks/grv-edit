import React from "react";

const lifecycle = ["PENDING", "PAID", "SHIPPED", "DELIVERED"];

const statusLabel = (status) =>
  status.charAt(0) + status.slice(1).toLowerCase();

const getTimelineStatus = (status, step) => {
  if (status === "CANCELLED") return "cancelled";
  const currentIndex = lifecycle.indexOf(status);
  const stepIndex = lifecycle.indexOf(step);
  if (stepIndex < currentIndex) return "complete";
  if (stepIndex === currentIndex) return "current";
  return "future";
};

const OrderTimeline = ({ status }) => (
  <section className="border-t border-gray-200 pt-6">
    <h3 className="font-semibold">Timeline</h3>
    <div className="mt-5 space-y-0">
      {lifecycle.map((step, index) => {
        const state = getTimelineStatus(status, step);
        return (
          <div key={step} className="relative flex gap-3 pb-5 last:pb-0">
            <div
              className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] ${state === "complete" || state === "current" ? "border-black bg-black text-white" : "border-gray-300 text-gray-400"}`}
            >
              {state === "complete" ? "✓" : index + 1}
            </div>
            {index < lifecycle.length - 1 && (
              <span
                className={`absolute left-2.25 top-5 h-full w-px ${state === "complete" ? "bg-black" : "bg-gray-200"}`}
              />
            )}
            <p className={state === "future" ? "text-gray-400" : "font-medium"}>
              {step === "PENDING"
                ? "Order Placed"
                : step === "PAID"
                  ? "Payment Confirmed"
                  : statusLabel(step)}
            </p>
          </div>
        );
      })}
      {status === "CANCELLED" && (
        <div className="flex gap-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center border border-black bg-black text-[10px] text-white">
            ×
          </div>
          <p className="font-medium">Cancelled</p>
        </div>
      )}
    </div>
  </section>
);

export default OrderTimeline;
