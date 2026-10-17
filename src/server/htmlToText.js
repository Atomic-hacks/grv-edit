// Plain-text alternative for every HTML email.
//
// A message with an HTML part and no text/plain part is one of the oldest
// and strongest spam signals there is — bulk senders that skip it get
// filtered on content long before anything else about them is considered.
// Every template here is HTML-only, so rather than hand-maintaining a second
// copy of each one, the text part is derived from the HTML at send time.
//
// This is a deliberately small converter for our own templates, not a
// general-purpose one: the markup it handles is the markup we generate.
const BLOCK_END =
  /<\/(p|div|tr|table|h1|h2|h3|h4|h5|h6|li|ul|ol|blockquote)>/gi;

const ENTITIES = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&middot;": "·",
  "&mdash;": "—",
  "&ndash;": "–",
};

export const htmlToText = (html) => {
  if (typeof html !== "string" || !html) return "";

  return (
    html
      // Drop anything that is not content.
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
      // Preheaders are hidden in the HTML; they would read as a duplicate
      // first line in the text part.
      .replace(/<span[^>]*display:none[\s\S]*?<\/span>/gi, "")
      // Keep a link's destination, which is the whole point of most of
      // these emails (verify, track order, unsubscribe).
      .replace(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_match, href, label) => {
          const text = label.replace(/<[^>]+>/g, "").trim();
          if (!text) return href;
          return href.startsWith("http") ? `${text}: ${href}` : text;
        },
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(BLOCK_END, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(
        /&[a-z#0-9]+;/gi,
        (entity) => ENTITIES[entity.toLowerCase()] ?? entity,
      )
      // Tidy the whitespace the markup left behind.
      .split("\n")
      .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
};
