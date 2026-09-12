export const getOptimizedImageUrl = (src, width) => {
  if (!src || !width || !src.includes("res.cloudinary.com")) return src;
  return src.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
};
