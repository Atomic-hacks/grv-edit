// Uploads a file straight from the browser to Cloudinary. Our API only
// signs the request (see src/api/handlers/uploads.js); the file itself
// never passes through a Vercel function, so the ~4.5MB function body
// limit doesn't apply — hero videos and full-size phone photos work.
//
// `request` is the authenticated API caller from createAuthenticatedRequest.
// Resolves to the uploaded file's https URL.
// Cloudinary free-plan limits; raise these if the plan is upgraded.
const MAX_BYTES = { image: 10 * 1024 * 1024, video: 100 * 1024 * 1024 };

export const uploadMedia = async (request, file) => {
  if (!file) throw new Error("Choose a file to upload");
  const resourceType = file.type?.startsWith("video/") ? "video" : "image";
  if (!file.type?.startsWith(`${resourceType}/`)) {
    throw new Error("Only image and video files can be uploaded");
  }
  if (file.size > MAX_BYTES[resourceType]) {
    throw new Error(
      resourceType === "video"
        ? "Videos must be under 100MB"
        : "Images must be under 10MB",
    );
  }

  const { uploadUrl, apiKey, timestamp, signature, params } = await request(
    "/api/admin/upload-signature",
    { method: "POST", body: JSON.stringify({ resourceType }) },
  );

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", apiKey);
  body.append("signature", signature);
  // timestamp, folder and (for video) eager — exactly what was signed.
  for (const [key, value] of Object.entries({ ...params, timestamp })) {
    body.append(key, String(value));
  }

  const response = await fetch(uploadUrl, { method: "POST", body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || "Upload failed — please try again");
  }
  return result.secure_url;
};
