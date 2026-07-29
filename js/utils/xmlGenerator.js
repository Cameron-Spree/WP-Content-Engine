/**
 * WordPress WXR 1.2 XML Generator for WP Content Engine
 * Generates fully compliant XML with Yoast SEO postmeta and attachment items.
 */

import { replaceImagePlaceholdersInHtml } from "./mediaMatcher.js";

export function generateWXRXML(posts, imagePool, siteMetadata = {}) {
  const {
    siteTitle = "WP Content Engine Site",
    siteUrl = "https://mysite.com",
    authorName = "admin"
  } = siteMetadata;

  const nowGmt = new Date().toUTCString();
  let nextPostId = 1001;
  let nextAttachmentId = 5001;

  // Track unique image URLs to attachment IDs
  const attachmentMap = new Map();
  const attachmentItemsXML = [];

  // Phase 1: Pre-collect all image assets to generate attachment <item> entries
  const allImagesToProcess = [];

  posts.forEach(post => {
    // Featured Image
    if (post.featured_image && post.featured_image.url) {
      allImagesToProcess.push(post.featured_image);
    }
    // Mapped Body Placeholders
    if (post.mapped_images) {
      Object.values(post.mapped_images).forEach(img => {
        if (img && img.url) allImagesToProcess.push(img);
      });
    }
  });

  // Unique images list
  const uniqueImages = [];
  const seenUrls = new Set();
  allImagesToProcess.forEach(img => {
    if (img && img.url && !seenUrls.has(img.url)) {
      seenUrls.add(img.url);
      uniqueImages.push(img);
    }
  });

  // Generate Attachment Items
  uniqueImages.forEach(img => {
    const attachmentId = nextAttachmentId++;
    attachmentMap.set(img.url, attachmentId);

    const filename = img.url.split("/").pop().split("?")[0] || `image-${attachmentId}.jpg`;
    const slug = slugify(img.title || filename.split(".")[0] || `image-${attachmentId}`);

    attachmentItemsXML.push(`
    <item>
      <title><![CDATA[${cdataClean(img.title || slug)}]]></title>
      <dc:creator><![CDATA[${cdataClean(authorName)}]]></dc:creator>
      <guid isPermaLink="false">${escapeXml(siteUrl)}/?attachment_id=${attachmentId}</guid>
      <pubDate>${nowGmt}</pubDate>
      <wp:post_id>${attachmentId}</wp:post_id>
      <wp:post_date><![CDATA[${formatWpDate(new Date())}]]></wp:post_date>
      <wp:post_date_gmt><![CDATA[${formatWpDate(new Date(), true)}]]></wp:post_date_gmt>
      <wp:comment_status><![CDATA[closed]]></wp:comment_status>
      <wp:ping_status><![CDATA[closed]]></wp:ping_status>
      <wp:post_name><![CDATA[${slug}]]></wp:post_name>
      <wp:status><![CDATA[inherit]]></wp:status>
      <wp:post_parent>0</wp:post_parent>
      <wp:menu_order>0</wp:menu_order>
      <wp:post_type><![CDATA[attachment]]></wp:post_type>
      <wp:post_password><![CDATA[]]></wp:post_password>
      <wp:is_sticky>0</wp:is_sticky>
      <wp:attachment_url><![CDATA[${cdataClean(img.url)}]]></wp:attachment_url>
    </item>`);
  });

  // Phase 2: Generate Post Items
  const postItemsXML = posts.map(post => {
    const postId = nextPostId++;
    const postSlug = post.slug || slugify(post.title);
    const postDate = post.post_date || formatWpDate(new Date());
    const postDateGmt = post.post_date_gmt || formatWpDate(new Date(), true);
    const postStatus = post.status || "publish";

    // Replace {{IMAGE:keyword}} in HTML with real <img> tags
    const finalContentHtml = replaceImagePlaceholdersInHtml(
      post.content_html,
      post.mapped_images,
      imagePool
    );

    // Categories
    const categoryTags = (post.categories || ["Uncategorized"]).map(cat => {
      const catSlug = slugify(cat);
      return `<category domain="category" nicename="${escapeXml(catSlug)}"><![CDATA[${cdataClean(cat)}]]></category>`;
    });

    // Tags
    const tagTags = (post.tags || []).map(tg => {
      const tgSlug = slugify(tg);
      return `<category domain="post_tag" nicename="${escapeXml(tgSlug)}"><![CDATA[${cdataClean(tg)}]]></category>`;
    });

    // Yoast Meta Fields
    const metaFields = [];
    if (post.yoast_meta_title) {
      metaFields.push(`
      <wp:postmeta>
        <wp:meta_key><![CDATA[_yoast_wpseo_title]]></wp:meta_key>
        <wp:meta_value><![CDATA[${cdataClean(post.yoast_meta_title)}]]></wp:meta_value>
      </wp:postmeta>`);
    }

    if (post.yoast_meta_desc) {
      metaFields.push(`
      <wp:postmeta>
        <wp:meta_key><![CDATA[_yoast_wpseo_metadesc]]></wp:meta_key>
        <wp:meta_value><![CDATA[${cdataClean(post.yoast_meta_desc)}]]></wp:meta_value>
      </wp:postmeta>`);
    }

    // Featured Image (_thumbnail_id)
    if (post.featured_image && post.featured_image.url) {
      const featAttId = attachmentMap.get(post.featured_image.url);
      if (featAttId) {
        metaFields.push(`
      <wp:postmeta>
        <wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key>
        <wp:meta_value><![CDATA[${featAttId}]]></wp:meta_value>
      </wp:postmeta>`);
      }
    }

    return `
    <item>
      <title><![CDATA[${cdataClean(post.title)}]]></title>
      <link>${escapeXml(siteUrl)}/${escapeXml(postSlug)}/</link>
      <pubDate>${nowGmt}</pubDate>
      <dc:creator><![CDATA[${cdataClean(authorName)}]]></dc:creator>
      <guid isPermaLink="false">${escapeXml(siteUrl)}/?p=${postId}</guid>
      <description></description>
      <content:encoded><![CDATA[${cdataClean(finalContentHtml)}]]></content:encoded>
      <excerpt:encoded><![CDATA[${cdataClean(post.yoast_meta_desc || "")}]]></excerpt:encoded>
      <wp:post_id>${postId}</wp:post_id>
      <wp:post_date><![CDATA[${postDate}]]></wp:post_date>
      <wp:post_date_gmt><![CDATA[${postDateGmt}]]></wp:post_date_gmt>
      <wp:comment_status><![CDATA[open]]></wp:comment_status>
      <wp:ping_status><![CDATA[open]]></wp:ping_status>
      <wp:post_name><![CDATA[${postSlug}]]></wp:post_name>
      <wp:status><![CDATA[${postStatus}]]></wp:status>
      <wp:post_parent>0</wp:post_parent>
      <wp:menu_order>0</wp:menu_order>
      <wp:post_type><![CDATA[post]]></wp:post_type>
      <wp:post_password><![CDATA[]]></wp:post_password>
      <wp:is_sticky>0</wp:is_sticky>
      ${categoryTags.join("\n      ")}
      ${tagTags.join("\n      ")}
      ${metaFields.join("")}
    </item>`;
  }).join("\n");

  // Construct Final WXR XML
  return `<?xml version="1.0" encoding="UTF-8" ?>
<!-- Generator: WP Content Engine v2.0 WXR Exporter -->
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wode="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
>
  <channel>
    <title><![CDATA[${cdataClean(siteTitle)}]]></title>
    <link>${escapeXml(siteUrl)}</link>
    <description><![CDATA[Bulk Post & Media Export Generated via WP Content Engine]]></description>
    <pubDate>${nowGmt}</pubDate>
    <language>en-US</language>
    <wp:wxr_version>1.2</wp:wxr_version>
    <wp:base_site_url>${escapeXml(siteUrl)}</wp:base_site_url>
    <wp:base_blog_url>${escapeXml(siteUrl)}</wp:base_blog_url>

    <wp:author>
      <wp:author_id>1</wp:author_id>
      <wp:author_login><![CDATA[${cdataClean(authorName)}]]></wp:author_login>
      <wp:author_email><![CDATA[admin@mysite.com]]></wp:author_email>
      <wp:author_display_name><![CDATA[${cdataClean(authorName)}]]></wp:author_display_name>
      <wp:author_first_name><![CDATA[]]></wp:author_first_name>
      <wp:author_last_name><![CDATA[]]></wp:author_last_name>
    </wp:author>

    <!-- ATTACHMENT MEDIA ITEMS -->
    ${attachmentItemsXML.join("\n")}

    <!-- BLOG POST ITEMS -->
    ${postItemsXML}

  </channel>
</rss>`;
}

function cdataClean(str) {
  if (!str) return "";
  return String(str).replace(/\]\]>/g, "]]&gt;");
}

function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function formatWpDate(d, isGmt = false) {
  const dateObj = isGmt ? new Date(d.getTime() + d.getTimezoneOffset() * 60000) : d;
  const pad = num => String(num).padStart(2, "0");
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
}
