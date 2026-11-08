-- Keep the tag ID and its product assignments; only fix the malformed URL value.
UPDATE "Tag"
SET "slug" = 'date-night', "name" = trim("name")
WHERE lower(trim("slug")) = 'date night'
  AND NOT EXISTS (SELECT 1 FROM "Tag" WHERE "slug" = 'date-night');

-- Add the existing contact photo to Page Sections without replacing admin content.
INSERT INTO "ContentSection" ("id", "page", "layout", "title", "description", "mediaType", "imageUrl", "updatedAt")
SELECT 'contact-page-image', 'CONTACT', 'BANNER', 'Contact photo', 'GRVHQ contact', 'IMAGE', '/img/goth-tower2.jpg', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "ContentSection" WHERE "page" = 'CONTACT');
