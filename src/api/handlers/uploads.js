// Signed direct uploads: the admin's browser sends the file straight to
// Cloudinary, and this server only signs the request.
//
// Why: a Vercel function rejects any request body over ~4.5MB before our
// code runs, on every plan. Proxying uploads through the API therefore
// capped hero videos at 4MB and silently broke large phone photos. With a
// signed direct upload the file never touches the function; the API secret
// still never leaves the server — the browser only ever receives a
// short-lived signature for this exact folder and timestamp.
import { v2 as cloudinary } from "cloudinary";
import { requireRole } from "../../server/requireRole.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Staff who manage catalogue or content can upload; customer roles can't.
const UPLOAD_ROLES = ["ADMIN"];

const FOLDERS = { image: "grv", video: "grv/video" };

// Videos are transcoded to this rendition at upload time, in the
// background, so the first visitor never waits on a cold transcode (tens of
// seconds for a long clip). Must match VIDEO_RENDITION in lib/imageHelpers.js.
const VIDEO_EAGER = "f_mp4,q_auto:eco,w_1280";

export const getUploadSignature = async (request) => {
  const guard = await requireRole(request, UPLOAD_ROLES);
  if (!guard.ok) return jsonResponse(guard.body, guard.status);

  const body = await request.json().catch(() => ({}));
  const resourceType = body.resourceType === "video" ? "video" : "image";

  const { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret } =
    cloudinary.config();
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Cloudinary credentials are not configured");
    return jsonResponse({ error: "Uploads are not configured" }, 500);
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = FOLDERS[resourceType];
  // Only these exact params are signed, so the browser can't change the
  // folder or add transformations without invalidating the signature.
  const signedParams =
    resourceType === "video"
      ? { eager: VIDEO_EAGER, eager_async: true, folder, timestamp }
      : { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(signedParams, apiSecret);

  return jsonResponse({
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    apiKey,
    timestamp,
    signature,
    // Everything that was signed, sent back verbatim for the browser to
    // include — Cloudinary rejects the upload if any of it differs.
    params: signedParams,
  });
};
