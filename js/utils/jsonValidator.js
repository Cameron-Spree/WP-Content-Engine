/**
 * JSON Syntax, Repair & Schema Validator for WP Content Engine
 * Auto-extracts JSON payloads even if surrounded by prompt text or chatbot commentary.
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
          error: `JSON Syntax Error: ${parseError || err2.message}. (Note: Make sure to copy the JSON response returned by the chatbot, not the prompt instruction).`,
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

  // 1. Strip markdown fences
  if (str.startsWith("```json")) {
    str = str.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (str.startsWith("```")) {
    str = str.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  // 2. Automatically extract JSON object {...} or array [...] if prompt text or chatbot commentary surrounds it
  // Distinguish valid JSON array '[' from markdown links like [url](url)
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

  // 3. Fix markdown links inside href attribute like href="[url](url)" or href="[http://...](http://...)"
  str = str.replace(/href=["']\[[^\]]+\]\(([^)]+)\)["']/gi, 'href=\'$1\'');
  str = str.replace(/href=\["[^\]]+"\]\(([^)]+)\)/gi, 'href=\'$1\'');

  return str;
}

function repairAIJsonString(raw) {
  let str = raw;
  str = str.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, "\\n");

  // Replace markdown links in href attributes within content_html
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
  return smartHtmlReconstructor(html);
}

function smartHtmlReconstructor(html) {
  if (!html) return "";
  let text = html.trim();

  // 1. Fix malformed HTML tags like blockquote> or </blockquote or <h2Title
  text = text.replace(/(?<!<)blockquote>/gi, "<blockquote>");
  text = text.replace(/<\/blockquote(?!>)/gi, "</blockquote>");

  // 2. Fix unclosed <a> tags
  text = text.replace(/<a\s+href=['"]([^'"]+)['"]\s*>([\s\S]*?)(?=(<a\s|<\/a>|<h[1-6]|<p|<div|<table|<ul|<ol|<blockquote>|$))/gi, (match, url, innerText) => {
    if (innerText.includes("</a>")) {
      return match;
    }

    let anchorText = innerText;
    let remainder = "";

    const knownLabels = [
      "STIHL Power Tools & Machinery", "STIHL Power Tools", "STIHL Machinery",
      "Lawn Mowers Range", "Lawn Mowers", "Chainsaws", "STIHL KombiSystem Multi-Tools", "KombiSystem",
      "2-Stroke Oils, MotoMix & Maintenance", "2-Stroke Oils", "MotoMix",
      "Chainsaw Protective Boots, Trousers & Helmets", "Chainsaw Protective Clothing",
      "Machinery Spares & Replacement Parts", "Machinery Spares",
      "Garden Machinery Repairs & Servicing", "Garden Machinery Repairs", "Garden Machinery",
      "Robotic Lawnmowers & iMOW"
    ];

    let matchedLabel = null;
    for (const label of knownLabels) {
      if (innerText.toLowerCase().startsWith(label.toLowerCase())) {
        matchedLabel = innerText.substring(0, label.length);
        remainder = innerText.substring(label.length);
        break;
      }
    }

    if (matchedLabel) {
      anchorText = matchedLabel;
    } else {
      const punctMatch = innerText.match(/^([^.,:!?]{3,60}?)([.,:!?]|\s+[A-Z]|\s*$)/);
      if (punctMatch) {
        anchorText = punctMatch[1].trim();
        remainder = innerText.substring(anchorText.length);
      } else {
        const words = innerText.trim().split(/\s+/);
        if (words.length > 6) {
          anchorText = words.slice(0, 5).join(" ");
          remainder = " " + words.slice(5).join(" ");
        }
      }
    }

    return `<a href='${url}'>${anchorText}</a>${remainder}`;
  });

  // 3. Reconstruct tables, CTAs, callouts, headings, and auto-hyperlinks if Gemini returned plain unformatted text
  text = reconstructPlainAIContent(text);

  return text;
}

function reconstructPlainAIContent(rawText) {
  let text = rawText.trim();

  // A. Format "💡 Want to Know More?" Callout Box if present
  text = text.replace(/(💡\s*Want to Know More\?\s*Recommended Reading)([\s\S]*?)(?=(Choosing STIHL|Visit our showroom|<p>|<h[1-6]|$))/i, (match, title, itemsText) => {
    const lines = itemsText.split(/(?=[A-Z])/).map(l => l.trim()).filter(Boolean);
    const listHtml = lines.map(line => {
      // Auto link if possible
      const linked = autoLinkText(line);
      return `<li>${linked}</li>`;
    }).join("\n    ");

    return `<div class='callout-box want-to-know-more'>\n  <h4>${title}</h4>\n  <ul>\n    ${listHtml}\n  </ul>\n</div>\n\n`;
  });

  // B. Format CTA Button lines (e.g. "Shop STIHL Power Tools & Machinery Range →")
  text = text.replace(/(Shop\s+[^→\n]+? Range\s*→)/gi, (match) => {
    return `<div class='category-spotlight-box'>\n  <h3>Explore STIHL Range at Briants of Risborough</h3>\n  <a href='https://briantsofrisborough.co.uk/product-category/brand/stihl/' class='spotlight-btn'>${match}</a>\n</div>\n\n`;
  });

  // C. Format Maintenance Schedule Tables if smashed together by AI
  text = text.replace(/(STIHL Machinery Service & Maintenance Schedule[\s\S]*?All Machinery[\s\S]*?Machinery Spares & Replacement Parts)/i, () => {
    return `<h2>STIHL Machinery Service & Maintenance Schedule</h2>
<div class='table-responsive'>
  <table>
    <thead>
      <tr>
        <th>Machine Type</th>
        <th>Recommended Frequency</th>
        <th>Key Maintenance Tasks</th>
        <th>Essential Supplies & Spares</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>STIHL Chainsaws</td>
        <td>Before every use & 25 Hours</td>
        <td>Check chain tension, lubricate chain, clean air filter, sharpen teeth</td>
        <td><a href='https://briantsofrisborough.co.uk/product-category/garden-machinery/chainsaw-accessories/'>Chainsaw Accessories & Chains</a></td>
      </tr>
      <tr>
        <td>Lawnmowers</td>
        <td>Monthly & Seasonal</td>
        <td>Inspect blade sharpness, change oil, check spark plug, clean deck housing</td>
        <td><a href='https://briantsofrisborough.co.uk/product-category/garden-machinery/oils-fuels-maintenance/'>2-Stroke Oils, MotoMix & Maintenance</a></td>
      </tr>
      <tr>
        <td>Grass Trimmers</td>
        <td>Every 10-15 Hours</td>
        <td>Refill trimmer line, clean air filter, clear debris from guard</td>
        <td><a href='https://briantsofrisborough.co.uk/product-category/garden-machinery/trimmer-lines-heads-blades/'>Trimmer Lines, Heads & Metal Blades</a></td>
      </tr>
      <tr>
        <td>All Machinery</td>
        <td>Annual / Pre-Winter</td>
        <td>Drain old fuel or add stabilizer, full mechanical overhaul, store indoors</td>
        <td><a href='https://briantsofrisborough.co.uk/product-category/garden-machinery/spares-and-parts/'>Machinery Spares & Replacement Parts</a></td>
      </tr>
    </tbody>
  </table>
</div>\n\n`;
  });

  // D. Extract Smashed Headings & Convert to <h2>
  const knownHeadingPhrases = [
    "Selecting the Right STIHL Machinery for Your Garden",
    "Essential STIHL Maintenance & Equipment Care",
    "When to Schedule Professional Lawnmower Service & Repairs",
    "Explore STIHL Power Tools & Machinery at Briants of Risborough"
  ];

  knownHeadingPhrases.forEach(h => {
    const reg = new RegExp(`([^\\n>])(${escapeRegExp(h)})`, 'g');
    text = text.replace(reg, '$1\n\n<h2>$2</h2>\n\n');
  });

  // E. If no <p> or <h2> tags exist, split text into paragraph blocks
  if (!/<p>|<h[1-6]>|<div>|<table>/i.test(text)) {
    // Separate by period + TitleCase
    text = text.replace(/([a-z0-9>])\.([A-Z][a-zA-Z\s]{12,60})(?=[A-Z][a-z])/g, '$1.\n\n<h2>$2</h2>\n\n');

    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    text = blocks.map(block => {
      if (block.startsWith("<h") || block.startsWith("<div") || block.startsWith("<table") || block.startsWith("<blockquote") || block.startsWith("<ul")) {
        return block;
      }
      return `<p>${block}</p>`;
    }).join("\n\n");
  }

  // F. Auto-Hyperlink internal link keywords throughout the text!
  text = autoLinkKeywordsInHtml(text);

  return text;
}

function autoLinkKeywordsInHtml(html) {
  if (!html) return "";
  let text = html;

  const linksBankMap = [
    { label: "STIHL Power Tools & Machinery", url: "https://briantsofrisborough.co.uk/product-category/brand/stihl/" },
    { label: "Garden Machinery Range", url: "https://briantsofrisborough.co.uk/product-category/garden-machinery/" },
    { label: "STIHL KombiSystem Multi-Tools", url: "https://briantsofrisborough.co.uk/product-category/garden-machinery/kombi-system-stihl/" },
    { label: "STIHL Chainsaws", url: "https://briantsofrisborough.co.uk/product-category/garden-machinery/chainsaws/" },
    { label: "Lawn Mowers Range", url: "https://briantsofrisborough.co.uk/product-category/garden-machinery/lawn-mowers/" },
    { label: "Robotic Lawnmowers & iMOW", url: "https://briantsofrisborough.co.uk/robotic-mowers/" },
    { label: "2-Stroke Oils, MotoMix & Maintenance", url: "https://briantsofrisborough.co.uk/product-category/garden-machinery/oils-fuels-maintenance/" },
    { label: "Chainsaw Accessories & Chains", url: "https://briantsofrisborough.co.uk/product-category/garden-machinery/chainsaw-accessories/" },
    { label: "Chainsaw Protective Boots, Trousers & Helmets", url: "https://briantsofrisborough.co.uk/product-category/ppe/chainsaw-protective-clothing/" },
    { label: "Trimmer Lines, Heads & Metal Blades", url: "https://briantsofrisborough.co.uk/product-category/garden-machinery/trimmer-lines-heads-blades/" },
    { label: "Machinery Spares & Replacement Parts", url: "https://briantsofrisborough.co.uk/product-category/garden-machinery/spares-and-parts/" },
    { label: "Garden Machinery Repairs & Servicing", url: "https://briantsofrisborough.co.uk/machinery-repairs/" }
  ];

  linksBankMap.forEach(item => {
    // Only replace if phrase is NOT inside an existing <a ...>...</a> tag or <h2...> tag
    const reg = new RegExp(`(?<!<a[^>]*>|<h2>|<h3>)(?<!href=['"])${escapeRegExp(item.label)}(?![^<]*<\\/a>)`, 'gi');
    let replaced = false;
    text = text.replace(reg, (match) => {
      if (!replaced) {
        replaced = true; // only replace first occurrence per post to prevent over-linking
        return `<a href='${item.url}'>${match}</a>`;
      }
      return match;
    });
  });

  return text;
}

function autoLinkText(textStr) {
  return autoLinkKeywordsInHtml(textStr);
}

function splitSmashedHeadingsAndParagraphs(rawText) {
  let text = rawText.trim();

  // Known heading phrases to extract as <h2>
  const knownHeadings = [
    "Choosing the Right STIHL Machinery for Your Garden",
    "Essential Maintenance: Chainsaws & Lawnmowers",
    "Professional Servicing & Genuine Spares at Briants",
    "Routine Chainsaw Maintenance:",
    "Safety Equipment:",
    "Seasonal Lawnmower Service:",
    "Equipment CategoryRecommended STIHL SolutionKey Application"
  ];

  // Insert linebreaks before known headings or Title Case sentences
  knownHeadings.forEach(h => {
    const regex = new RegExp(`([^\\n>])(${escapeRegExp(h)})`, 'g');
    text = text.replace(regex, '$1\n\n<h2>$2</h2>\n\n');
  });

  // Also detect Title Case phrases following periods without spacing: .Choosing, .Essential, .Professional
  text = text.replace(/([a-z0-9>])\.([A-Z][a-zA-Z\s]{10,60})(?=[A-Z][a-z])/g, '$1.\n\n<h2>$2</h2>\n\n');

  // Wrap all non-heading text blocks into <p>...</p>
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const formatted = blocks.map(block => {
    if (block.startsWith("<h") || block.startsWith("<blockquote") || block.startsWith("<table") || block.startsWith("<ul") || block.startsWith("<ol")) {
      return block;
    }
    return `<p>${block}</p>`;
  });

  return formatted.join("\n\n");
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function autoWrapParagraphs(html) {
  if (!html) return "";
  return html;
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
