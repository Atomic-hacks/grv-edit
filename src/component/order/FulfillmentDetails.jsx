import React from "react";

const STATUS_LABELS = {
  PLACED: "Order placed",
  PAYMENT_CONFIRMED: "Payment confirmed",
  PROCESSING: "Processing",
  READY_TO_SHIP: "Ready to ship",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery attempt failed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );

const formatDateTime = (value) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

// Shows the manual (pre-courier-API) fulfilment state: current status,
// whatever courier/tracking detail an admin has entered, and the
// chronological history of status changes. Renders nothing extra beyond
// "Order placed" if fulfilment hasn't progressed yet.
const FulfillmentDetails = ({ fulfillment }) => {
  if (!fulfillment) return null;
  const {
    status,
    courierName,
    trackingNumber,
    trackingUrl,
    shippingDate,
    estimatedDeliveryDate,
    deliveryNotes,
    events,
  } = fulfillment;

  return (
    <section className="mt-8 border border-gray-200 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Shipment
      </h2>
      <p className="mt-4 text-sm font-semibold">
        {STATUS_LABELS[status] || status}
      </p>

      {(courierName ||
        trackingNumber ||
        shippingDate ||
        estimatedDeliveryDate) && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {courierName && (
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-gray-500">
                Carrier
              </dt>
              <dd className="mt-1">{courierName}</dd>
            </div>
          )}
          {trackingNumber && (
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-gray-500">
                Tracking number
              </dt>
              <dd className="mt-1">
                {trackingUrl ? (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    {trackingNumber}
                  </a>
                ) : (
                  trackingNumber
                )}
              </dd>
            </div>
          )}
          {shippingDate && (
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-gray-500">
                Shipped
              </dt>
              <dd className="mt-1">{formatDate(shippingDate)}</dd>
            </div>
          )}
          {estimatedDeliveryDate && (
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-gray-500">
                Estimated delivery
              </dt>
              <dd className="mt-1">{formatDate(estimatedDeliveryDate)}</dd>
            </div>
          )}
        </dl>
      )}

      {deliveryNotes && (
        <p className="mt-4 border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {deliveryNotes}
        </p>
      )}

      {events?.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-gray-200 pt-4">
          {events.map((event, index) => (
            <div
              key={`${event.status}-${index}`}
              className="flex items-center justify-between text-xs text-gray-600"
            >
              <span>{STATUS_LABELS[event.status] || event.status}</span>
              <span>{formatDateTime(event.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default FulfillmentDetails;
