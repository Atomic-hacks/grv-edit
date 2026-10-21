// Lock the subscriptions while creating their outbox records. Bulk writes keep
// a large waitlist from turning a restock into hundreds of database round trips.
export const queueWaitlistRestock = async (transaction, variant) => {
  const entries = await transaction.$queryRaw`
    SELECT id, "userId" FROM "WaitlistEntry"
    WHERE "variantId" = ${variant.variantId} AND status = 'WAITING'
    ORDER BY id FOR UPDATE`;
  if (!entries.length) return [];
  const notifications = await transaction.notification.createManyAndReturn({
    data: entries.map((entry) => ({
      userId: entry.userId, productId: variant.productId,
      waitlistEntryId: entry.id,
      type: "WAITLIST_RESTOCK", sent: false,
      message: `${variant.productName} (${variant.color}, ${variant.size}) is back in stock!`,
    })),
  });
  await transaction.waitlistEntry.updateMany({ where: { id: { in: entries.map((entry) => entry.id) } }, data: { status: "NOTIFIED", deliveryStatus: "QUEUED", notifiedAt: new Date(), lastDeliveryError: null } });
  return notifications;
};

// Commit notification records before contacting the email provider. A slow
// provider must never time out or roll back an inventory update.
export const processWaitlistRestocks = async (
  variants,
  { prisma, sendNotificationEmail },
) => {
  for (const variant of variants) {
    try {
      if (process.env.SIMULATE_RESTOCK_NOTIFICATION_FAILURE === "1") {
        throw new Error("Simulated restock notification failure");
      }
      const notifications = await prisma.$transaction(async (transaction) => {
        return queueWaitlistRestock(transaction, variant);
      });
      for (const notification of notifications) {
        try {
          // Failed sends stay sent:false for the existing admin retry endpoint.
          await sendNotificationEmail(prisma, notification, {
            name: variant.productName,
            imageUrl: variant.productImageUrl,
          });
        } catch (error) {
          console.error("Restock email failed", { notificationId: notification.id, error });
        }
      }
    } catch (error) {
      console.error("Restock notification processing failed", { variantId: variant.variantId, error });
    }
  }
};
