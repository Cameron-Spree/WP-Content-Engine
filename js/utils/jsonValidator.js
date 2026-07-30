/**
 * JSON Syntax, Repair & Schema Validator for WP Content Engine
 * Parses raw chatbot JSON (supports ```json blocks) and cleans HTML.
 */

export function parseAndValidateJSON(rawInput) {
  if (!rawInput || !rawInput.trim()) {
    return { valid: false, error: "Input is empty." };
  }

  let cleaned = preCleanAIJsonString(rawInput);

  let parsedData = null;
  let parseError = null;

  try {
    parsedData = JSON.parse(cleaned);
  } catch (err) {
    parseError = err.message;
  }

  if (!parsedData) {
    try {
      const repaired = repairAIJsonString(cleaned);
      parsedData = JSON.parse(repaired);
      parseError = null;
    } catch (err2) {
      const extracted = fallbackRegexExtractPost(cleaned);
      if (extracted) {
        parsedData = extracted;
        parseError = null;
      } else {
        return {
          valid: false,
          error: `JSON Syntax Error: ${parseError || err2.message}. (Tip: Copy the \`\`\`json block from your chatbot).`,
          rawError: parseError || err2.message
        };
      }
    }
  }

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

    let cleanContentHtml = cleanHtmlMarkdownLinks(p.content_html);
    cleanContentHtml = autoFixUnclosedAnchorTags(cleanContentHtml);
    cleanContentHtml = autoWrapParagraphs(cleanContentHtml);
    cleanContentHtml = enrichWidgetHtmlStyles(cleanContentHtml);

    const slug = p.slug || generateSlug(p.title);
    const categories = Array.isArray(p.categories) ? p.categories : (p.categories ? [p.categories] : ["Uncategorized"]);
    const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : []);
    const yoast_meta_title = p.yoast_meta_title || p.title.substring(0, 60);
    const yoast_meta_desc = p.yoast_meta_desc || stripHtml(cleanContentHtml).substring(0, 155);

    const extractedPlaceholders = extractPlaceholdersFromHtml(cleanContentHtml);
    const image_placeholders = Array.isArray(p.image_placeholders) 
      ? [...new Set([...p.image_placeholders.map(k => String(k).trim().toLowerCase()), ...extractedPlaceholders])]
      : extractedPlaceholders;

    validatedPosts.push({
      id: "post_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      title: p.title.trim(),
      slug: slug.trim(),
      categories: categories.map(c => String(c).trim()),
      tags: tags.map(t => String(t).trim()),
      yoast_meta_title: yoast_meta_title.trim(),
      yoast_meta_desc: yoast_meta_desc.trim(),
      content_html: cleanContentHtml,
      image_placeholders,
      status: "publish",
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

function preCleanAIJsonString(raw) {
  let str = raw.trim();

  // 1. Strip markdown fences ```json ... ```
  if (str.includes("```json")) {
    str = str.replace(/[\s\S]*?```json\s*/i, "").replace(/\s*```[\s\S]*/, "");
  } else if (str.includes("```")) {
    str = str.replace(/[\s\S]*?```\s*/, "").replace(/\s*```[\s\S]*/, "");
  }

  // 2. Extract JSON object {...} or array [...]
  const firstBrace = str.indexOf("{");
  let firstBracket = -1;
  const bracketMatch = str.match(/\[\s*(?=[{\"\d\]]|-\d|true|false|null)/);
  if (bracketMatch) {
    firstBracket = bracketMatch.index;
  }
  
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = str.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = str.lastIndexOf("]");
  }

  if (startIdx !== -1 && endIdx > startIdx) {
    str = str.substring(startIdx, endIdx + 1);
  }

  return str;
}

function repairAIJsonString(jsonStr) {
  let repaired = jsonStr
    .replace(/[\u0000-\u001F]+/g, (match) => {
      if (match === "\n") return "\\n";
      if (match === "\r") return "\\r";
      if (match === "\t") return "\\t";
      return "";
    })
    .replace(/,\s*([\}\]])/g, "$1");

  return repaired;
}

function fallbackRegexExtractPost(rawStr) {
  const titleMatch = rawStr.match(/"title"\s*:\s*"([^"]+)"/);
  const contentMatch = rawStr.match(/"content_html"\s*:\s*"([\s\S]+?)"\s*,\s*"/);

  if (titleMatch && contentMatch) {
    return {
      title: titleMatch[1],
      content_html: contentMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
    };
  }
  return null;
}

function cleanHtmlMarkdownLinks(html) {
  if (!html) return "";

  let clean = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, (match, text, url) => {
    return `<a href="${url}">${text}</a>`;
  });

  clean = clean.replace(/<a\s+href=['"]([^'"]+)['"]>([^<]+)<\/a>/g, (match, url, text) => {
    return `<a href="${url}">${text}</a>`;
  });

  return clean;
}

function enrichWidgetHtmlStyles(html) {
  if (!html) return "";
  let clean = html;

  // Enrich Category Spotlight CTA Banner with inline CSS
  clean = clean.replace(/<div\s+class=['"]category-spotlight-box['"]([^>]*)>/gi, (match, attrs) => {
    if (attrs.includes("style=")) return match;
    return `<div class='category-spotlight-box' style='background: linear-gradient(135deg, #1c1917 0%, #0c0a09 100%); border: 2px solid #eab308; border-radius: 12px; padding: 28px 24px; margin: 36px 0; text-align: center; color: #ffffff;'>`;
  });

  clean = clean.replace(/<h3([^>]*)>\s*Explore STIHL Range at Briants of Risborough\s*<\/h3>/gi, (match) => {
    return `<h3 style='color: #eab308; font-size: 22px; font-weight: 700; margin: 0 0 10px 0; font-family: sans-serif;'>Explore STIHL Range at Briants of Risborough</h3>`;
  });

  clean = clean.replace(/<a\s+href=['"]([^'"]+)['"]\s+class=['"]spotlight-btn['"]([^>]*)>/gi, (match, url, attrs) => {
    if (attrs.includes("style=")) return match;
    return `<a href='${url}' class='spotlight-btn' style='display: inline-block; background: #eab308; color: #000000; font-weight: 700; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; font-family: sans-serif; box-shadow: 0 4px 12px rgba(234,179,8,0.3);'>`;
  });

  // Enrich Want to Know More Callout Box with inline CSS
  clean = clean.replace(/<div\s+class=['"]callout-box want-to-know-more['"]([^>]*)>/gi, (match, attrs) => {
    if (attrs.includes("style=")) return match;
    return `<div class='callout-box want-to-know-more' style='background: rgba(234, 179, 8, 0.08); border-left: 4px solid #eab308; border-radius: 8px; padding: 20px 24px; margin: 32px 0;'>`;
  });

  clean = clean.replace(/<h4([^>]*)>\s*💡 Want to Know More\? Recommended Reading\s*<\/h4>/gi, (match) => {
    return `<h4 style='color: #eab308; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; font-family: sans-serif;'>💡 Want to Know More? Recommended Reading</h4>`;
  });

  return clean;
}

function autoFixUnclosedAnchorTags(html) {
  if (!html) return "";
  const openCount = (html.match(/<a\s/gi) || []).length;
  const closeCount = (html.match(/<\/a>/gi) || []).length;

  if (openCount > closeCount) {
    return html.replace(/(<a\s+href=['"][^'"]+['"][^>]*>[^<]+)(?!\s*<\/a>)(?=\s*<|\s*$)/gi, "$1</a>");
  }
  return html;
}

function autoWrapParagraphs(html) {
  if (!html) return "";
  if (html.includes("<p>") || html.includes("<h2>") || html.includes("<div>")) {
    return html;
  }
  return html
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p}</p>`)
    .join("\n");
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function stripHtml(html) {
  return html.replace(/<[^>]*>?/gm, "").trim();
}

function extractPlaceholdersFromHtml(html) {
  const regex = /\{\{IMAGE:([^}]+)\}\}/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1].trim().toLowerCase());
  }
  return [...new Set(matches)];
}

function formatDateTime(d) {
  const pad = num => String(num).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
