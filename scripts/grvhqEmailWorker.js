// Cloudflare Email Worker. Only attach the four GRVHQ address rules to this
// worker; keep the domain's existing MX records and catch-all behavior intact.
export default {
  async email(message) {
    const addresses = new Set([
      "info@grvhq.com", "support@grvhq.com", "fegorovie@grvhq.com", "noreply@grvhq.com",
    ]);
    if (!addresses.has(message.to.toLowerCase())) {
      message.setReject("Unknown GRVHQ mailbox");
      return;
    }
    const headers = new Headers({ "X-GRVHQ-Original-Recipient": message.to.toLowerCase() });
    // Both addresses must be verified Cloudflare destinations before enabling
    // any rules. Attempt both deliveries even if one destination fails.
    const results = await Promise.allSettled([
      message.forward("grvwears@yahoo.com"),
      message.forward("dashboard@inbound.grvhq.com", headers),
    ]);
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("A GRVHQ inbox delivery failed; inspect Email Routing delivery logs.");
    }
  },
};
