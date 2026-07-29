/**
 * JSON Syntax and Schema Validator for WP Content Engine
 */

export function parseAndValidateJSON(rawInput) {
  if (!rawInput || !rawInput.trim()) {
    return { valid: false, error: "Input is empty." };
  }

  let cleaned = rawInput.trim();

  // Strip markdown code block fences if user accidentally pasted ```json ... ```
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  let parsedData;
  try {
    parsedData = JSON.parse(cleaned);
  } catch (err) {
    return {
      valid: false,
      error: `JSON Syntax Error: ${err.message}`,
      rawError: err.message
    };
  }

  // Normalize single object or array
  const posts = Array.isArray(parsedData) ? parsedData : [parsedData];
  const validatedPosts = [];

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const postIndexLabel = posts.length > 1 ? `Post #${i + 1}: ` : "";

    if (typeof p !== "object" || p === null) {
      return { valid: false, error: `${postIndexLabel}Invalid JSON item format. Must be an object.` };
    }

    if (!p.title || typeof p.title !== "string") {
      return { valid: false, error: `${postIndexLabel}Missing or invalid 'title' string.` };
    }

    if (!p.content_html || typeof p.content_html !== "string") {
      return { valid: false, error: `${postIndexLabel}Missing or invalid 'content_html' string.` };
    }

    // Auto-fill missing optional properties with sensible defaults
    const slug = p.slug || generateSlug(p.title);
    const categories = Array.isArray(p.categories) ? p.categories : (p.categories ? [p.categories] : ["Uncategorized"]);
    const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : []);
    const yoast_meta_title = p.yoast_meta_title || p.title.substring(0, 60);
    const yoast_meta_desc = p.yoast_meta_desc || stripHtml(p.content_html).substring(0, 155);

    // Extract any image placeholders {{IMAGE:keyword}} directly from content_html if not provided
    const extractedPlaceholders = extractPlaceholdersFromHtml(p.content_html);
    const image_placeholders = Array.isArray(p.image_placeholders) 
      ? [...new Set([...p.image_placeholders, ...extractedPlaceholders])]
      : extractedPlaceholders;

    validatedPosts.push({
      id: "post_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      title: p.title.trim(),
      slug: slug.trim(),
      categories: categories.map(c => String(c).trim()),
      tags: tags.map(t => String(t).trim()),
      yoast_meta_title: yoast_meta_title.trim(),
      yoast_meta_desc: yoast_meta_desc.trim(),
      content_html: p.content_html.trim(),
      image_placeholders,
      status: "publish", // Default status, recalculated by scheduler
      post_date: formatDateTime(new Date()),
      featured_image_id: null,
      mapped_images: {}
    });
  }

  return {
    valid: true,
    posts: validatedPosts,
    count: validatedPosts.length
  };
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function stripHtml(html) {
  return html.replace(/<[^>]*>?/gm, "").trim();
}

function extractPlaceholdersFromHtml(html) {
  const regex = /\{\{IMAGE:([a-zA-Z0-9_-]+)\}\}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1].toLowerCase());
  }
  return [...new Set(matches)];
}

function formatDateTime(d) {
  const pad = num => String(num).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
