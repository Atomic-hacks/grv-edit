import { prisma } from "./prisma.js";
import { sendEmail } from "./sendEmail.js";

const SIX_HOURS = 6 * 60 * 60 * 1000;
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const siteUrl = () => process.env.APP_URL || "http://localhost:5176";

const formatCartEmail = (cart, productsById) => {
  const lines = cart.items
    .map((item) => {
      const product = productsById.get(item.productId);
      const name = product?.name || "Item from your cart";
      const image = product?.imageUrl
        ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(name)}" width="80" />`
        : "";
      return `<li>${image}<strong>${escapeHtml(name)}</strong> &times; ${item.quantity}</li>`;
    })
    .join("");

  return `<p>You left something in your cart.</p><ul>${lines}</ul><p><a href="${escapeHtml(`${siteUrl()}/shop`)}">Return to GRV</a></p>`;
};

const formatWishlistEmail = (wishlist) => {
  const product = wishlist.product;
  const image = product.imageUrl
    ? `<p><img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" width="240" /></p>`
    : "";
  const productUrl = `${siteUrl()}/product/${encodeURIComponent(product.id)}`;
  return `${image}<p>Still thinking about <strong>${escapeHtml(product.name)}</strong>?</p><p><a href="${escapeHtml(productUrl)}">Take another look</a></p>`;
};

const describeError = (kind, id, error) =>
  `${kind} ${id}: ${error instanceof Error ? error.message : String(error)}`;

export const runReminderChecks = async ({
  prismaClient = prisma,
  emailSender = sendEmail,
  now = new Date(),
} = {}) => {
  const errors = [];
  let cartsReminded = 0;
  let wishlistsReminded = 0;

  let abandonedCarts = [];
  try {
    abandonedCarts = await prismaClient.cart.findMany({
      where: {
        updatedAt: { lt: new Date(now.getTime() - SIX_HOURS) },
        abandonedReminderSent: false,
        items: { some: {} },
      },
      select: {
        id: true,
        user: { select: { email: true } },
        items: { select: { productId: true, quantity: true } },
      },
    });
  } catch (error) {
    const message = `Cart reminder query failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    console.error(message);
  }

  const cartProductIds = [
    ...new Set(
      abandonedCarts.flatMap((cart) =>
        cart.items.map((item) => item.productId),
      ),
    ),
  ];
  let cartProducts = [];
  try {
    cartProducts = cartProductIds.length
      ? await prismaClient.product.findMany({
          where: { id: { in: cartProductIds } },
          select: { id: true, name: true, imageUrl: true },
        })
      : [];
  } catch (error) {
    const message = `Cart product lookup failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    console.error(message);
  }
  const productsById = new Map(
    cartProducts.map((product) => [product.id, product]),
  );

  for (const cart of abandonedCarts) {
    try {
      const sent = await emailSender({
        to: cart.user.email,
        subject: "You left something in your cart",
        html: formatCartEmail(cart, productsById),
      });
      if (!sent) throw new Error("Email provider did not accept the message");

      await prismaClient.cart.update({
        where: { id: cart.id },
        data: { abandonedReminderSent: true },
      });
      cartsReminded += 1;
    } catch (error) {
      const message = describeError("Cart reminder", cart.id, error);
      errors.push(message);
      console.error(message);
    }
  }

  let staleWishlists = [];
  try {
    staleWishlists = await prismaClient.wishlist.findMany({
      where: {
        createdAt: { lt: new Date(now.getTime() - THREE_DAYS) },
        reminderSent: false,
      },
      select: {
        id: true,
        user: { select: { email: true } },
        product: { select: { id: true, name: true, imageUrl: true } },
      },
    });
  } catch (error) {
    const message = `Wishlist reminder query failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    console.error(message);
  }

  for (const wishlist of staleWishlists) {
    try {
      const sent = await emailSender({
        to: wishlist.user.email,
        subject: "Still thinking about it?",
        html: formatWishlistEmail(wishlist),
      });
      if (!sent) {
        errors.push(
          `Wishlist reminder ${wishlist.id}: Email provider did not accept the message`,
        );
      }
    } catch (error) {
      const message = describeError("Wishlist reminder", wishlist.id, error);
      errors.push(message);
      console.error(message);
    } finally {
      try {
        await prismaClient.wishlist.update({
          where: { id: wishlist.id },
          data: { reminderSent: true },
        });
        wishlistsReminded += 1;
      } catch (error) {
        const message = describeError(
          "Wishlist reminder update",
          wishlist.id,
          error,
        );
        errors.push(message);
        console.error(message);
      }
    }
  }

  return { cartsReminded, wishlistsReminded, errors };
};

export default runReminderChecks;
