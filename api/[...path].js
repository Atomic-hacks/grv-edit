import { handleApiRequest } from "../src/api/routes.js";

const hasRequestBody = (method) => method !== "GET" && method !== "HEAD";

const toWebHeaders = (headers) => {
  const webHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) webHeaders.append(name, item);
    } else if (value !== undefined) {
      webHeaders.set(name, value);
    }
  }
  return webHeaders;
};

const toWebRequest = (req) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url || "/"}`;

  return new Request(url, {
    method: req.method,
    headers: toWebHeaders(req.headers),
    body: hasRequestBody(req.method) ? req : undefined,
    duplex: "half",
  });
};

const sendWebResponse = async (webResponse, res) => {
  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await webResponse.text());
};

export default async function handler(req, res) {
  try {
    await sendWebResponse(await handleApiRequest(toWebRequest(req)), res);
  } catch (error) {
    console.error("API request failed", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
