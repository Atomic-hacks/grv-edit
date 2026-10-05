// Cloudinary-hosted media is delivered resized and recompressed; anything
// else (a local /img path, another host) is returned untouched.

export const getOptimizedImageUrl = (src, width) => {
  if (!src || !width || !src.includes("res.cloudinary.com")) return src;
  return src.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
};

// Videos are pinned to ONE exact rendition (MP4, eco quality, 1280px wide)
// rather than f_auto. Cloudinary transcodes each distinct rendition the
// first time it's requested — tens of seconds for a long clip — so f_auto
// (which varies by browser) would leave the first Chrome visitor, the first
// Safari visitor, etc. each waiting on a cold transcode. A single rendition
// is generated once, at upload time (see handlers/uploads.js `eager`), and
// every visitor gets it from the CDN.
export const VIDEO_RENDITION = "f_mp4,q_auto:eco,w_1280";

const isCloudinaryVideo = (src) =>
  Boolean(src) && src.includes("res.cloudinary.com") && src.includes("/video/upload/");

export const getOptimizedVideoUrl = (src) =>
  isCloudinaryVideo(src) ? src.replace("/upload/", `/upload/${VIDEO_RENDITION}/`) : src;

// First frame of a Cloudinary video as a JPEG, used as the poster so
// something paints immediately while the video itself buffers.
export const getVideoPosterUrl = (src) => {
  if (!isCloudinaryVideo(src)) return null;
  return src
    .replace("/upload/", "/upload/so_0,f_jpg,q_auto,w_1280/")
    .replace(/\.[a-z0-9]+$/i, ".jpg");
};
