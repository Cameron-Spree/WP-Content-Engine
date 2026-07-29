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

    const slug = p.slug || generateSlug(p.title);
    const categories = Array.isArray(p.categories) ? p.categories : (p.categories ? [p.categories] : ["Uncategorized"]);
    const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : []);
    const yoast_meta_title = p.yoast_meta_title || p.title.substring(0, 60);
    const yoast_meta_desc = p.yoast_meta_desc || stripHtml(cleanContentHtml).substring(0, 155);

    const extractedPlaceholders = extractPlaceholdersFromHtml(cleanContentHtml);
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

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    str = str.substring(startIdx, endIdx + 1);
  }

  // 3. Fix markdown links inside href attribute
  str = str.replace(/href=["']\[[^\]]+\]\(([^)]+)\)["']/gi, 'href=\'$1\'');
  str = str.replace(/href=\["[^\]]+"\]\(([^)]+)\)/gi, 'href=\'$1\'');

  return str;
}

function repairAIJsonString(raw) {
  let str = raw;
  str = str.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, "\\n");
  str = str.replace(/href=["']\[[^\]]+\]\(([^)]+)\)["']/gi, 'href=\'$1\'');

  const contentMatch = str.match(/"content_html"\s*:\s*"(.*?)"\s*(\}\s*$|\,\s*"[a-zA-Z0-9_]+"\s*:)/s);
  if (contentMatch) {
    const originalContent = contentMatch[1];
    const fixedContent = originalContent.replace(/<([^>]+)>/g, (tag) => {
      return tag.replace(/(\w+)=(?:"([^"]*)"|'([^']*)')/g, '$1=\'$2$3\'');
    });
    str = str.replace(originalContent, fixedContent);
  }

  return str;
}

function cleanHtmlMarkdownLinks(html) {
  if (!html) return "";
  let clean = html;

  clean = clean.replace(/href=["']\[[^\]]+\]\(([^)]+)\)["']/gi, 'href=\'$1\'');
  clean = clean.replace(/href=\["[^\]]+"\]\(([^)]+)\)/gi, 'href=\'$1\'');
  clean = clean.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href=\'$2\'>$1</a>');

  return clean;
}

function autoFixUnclosedAnchorTags(html) {
  if (!html) return "";
  let text = html.trim();

  // Close unclosed <a href='...'> tags cleanly
  text = text.replace(/<a\s+href=['"]([^'"]+)['"]\s*>([\s\S]*?)(?=(<a\s|<\/a>|<h[1-6]|<p|<div|<table|<ul|<ol|<blockquote>|$))/gi, (match, url, innerText) => {
    if (innerText.includes("</a>")) {
      return match;
    }
    const words = innerText.trim().split(/\s+/);
    let anchorText = innerText;
    let remainder = "";
    if (words.length > 5) {
      anchorText = words.slice(0, 4).join(" ");
      remainder = " " + words.slice(4).join(" ");
    }
    return `<a href='${url}'>${anchorText}</a>${remainder}`;
  });

  return text;
}

function autoWrapParagraphs(html) {
  if (!html) return "";
  let text = html.trim();

  // If text doesn't have <p> tags, split by double newlines and wrap in <p>
  if (!/<p>|<h[1-6]>|<div>|<table>/i.test(text)) {
    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    text = blocks.map(block => `<p>${block}</p>`).join("\n\n");
  }

  return text;
}

function fallbackRegexExtractPost(raw) {
  try {
    const titleMatch = raw.match(/"title"\s*:\s*"([^"]+)"/);
    const slugMatch = raw.match(/"slug"\s*:\s*"([^"]+)"/);
    const contentMatch = raw.match(/"content_html"\s*:\s*"([\s\S]+?)"\s*(\}\s*$|\,\s*"[a-zA-Z0-9_]+"\s*:)/);

    if (titleMatch && contentMatch) {
      return {
        title: titleMatch[1],
        slug: slugMatch ? slugMatch[1] : generateSlug(titleMatch[1]),
        categories: ["Garden Machinery"],
        tags: ["stihl"],
        yoast_meta_title: titleMatch[1],
        yoast_meta_desc: "",
        content_html: contentMatch[1]
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function generateSlug(text) {
  return String(text || "")
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
