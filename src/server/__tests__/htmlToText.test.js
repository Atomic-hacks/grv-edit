import { describe, it, expect } from "vitest";
import { htmlToText } from "../htmlToText.js";
import { unsubscribeHeaders } from "../campaigns.js";

describe("htmlToText", () => {
  it("produces a readable text part from an email template", () => {
    const text = htmlToText(
      "<p>Your order is on its way.</p><p>Thanks for shopping with GRV.</p>",
    );
    expect(text).toBe("Your order is on its way.\n\nThanks for shopping with GRV.");
  });

  it("keeps link destinations, which is the point of most of these emails", () => {
    expect(
      htmlToText('<a href="https://www.grvhq.com/account">Track your order</a>'),
    ).toBe("Track your order: https://www.grvhq.com/account");
  });

  it("drops the hidden preheader instead of repeating it", () => {
    const text = htmlToText(
      '<span style="display:none;opacity:0;">Hidden preheader</span><p>Real body</p>',
    );
    expect(text).not.toContain("Hidden preheader");
    expect(text).toContain("Real body");
  });

  it("strips style and script blocks entirely", () => {
    const text = htmlToText("<style>p{color:red}</style><p>Body</p>");
    expect(text).toBe("Body");
  });

  it("decodes the entities the templates emit", () => {
    expect(htmlToText("<p>GRV &middot; Tops &amp; Tees &mdash; 50% off</p>")).toBe(
      "GRV · Tops & Tees — 50% off",
    );
  });

  it("collapses runaway whitespace from table markup", () => {
    const text = htmlToText(
      "<table><tr><td>  A  </td></tr><tr><td>  B  </td></tr></table>",
    );
    expect(text).toBe("A\n\nB");
  });

  it("never returns undefined for junk input", () => {
    for (const value of ["", null, undefined, 42]) {
      expect(htmlToText(value), String(value)).toBe("");
    }
  });
});

describe("unsubscribeHeaders (RFC 8058 one-click)", () => {
  it("emits both headers Gmail and Yahoo look for", () => {
    expect(unsubscribeHeaders("https://www.grvhq.com/unsubscribe?token=abc")).toEqual({
      "List-Unsubscribe": "<https://www.grvhq.com/unsubscribe?token=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("omits them when there is no link, so non-bulk mail does not claim to be bulk", () => {
    expect(unsubscribeHeaders(null)).toBeUndefined();
    expect(unsubscribeHeaders(undefined)).toBeUndefined();
    expect(unsubscribeHeaders("")).toBeUndefined();
  });
});
