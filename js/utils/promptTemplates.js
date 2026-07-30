/**
 * AI System Prompt Generator Template (Briants of Risborough Edition)
 * Single Article Mode & Bulk Topical Cluster Mode
 */

export function generateAIPrompt(params) {
  const {
    topic = "The Complete Guide to Selecting & Maintaining STIHL Garden Machinery",
    keywords = "stihl garden machinery, chainsaw maintenance",
    niche = "Briants of Risborough - Garden Machinery & Tools",
    tone = "Authoritative, practical, & expert guidance",
    wordCount = "800-1200 words",
    imageCount = "0",
    linksBank = [],
    queuedBatchPosts = [],
    siteDomain = "https://briantsofrisborough.co.uk",
    blogSubpath = "/blog/",
    widgets = {
      wantToKnowMore: true,
      categorySpotlight: true,
      table: true,
      strictFormatting: true
    }
  } = params;

  // Build Internal Links Target Pool
  const allInternalTargets = [];

  linksBank.forEach(item => {
    if (item.url && item.label) {
      allInternalTargets.push(`- ${item.url} (Anchor Text: "${item.label}")`);
    } else if (typeof item === "string" && item.trim()) {
      allInternalTargets.push(`- ${item.trim()}`);
    }
  });

  queuedBatchPosts.forEach(post => {
    const fullBlogUrl = `${siteDomain.replace(/\/$/, "")}${blogSubpath}${post.slug.replace(/^\//, "")}`;
    allInternalTargets.push(`- ${fullBlogUrl} (Batch Article: "${post.title}")`);
  });

  const urlSection = allInternalTargets.length > 0
    ? `\n### Master Internal Links Bank:\nSeamlessly hyperlink appropriate anchor phrases in your text to these URLs. MANDATORY RULE: Use single quotes for href attributes, e.g. <a href='https://...'>Anchor Phrase</a>.\n${allInternalTargets.join("\n")}\n`
    : "";

  // Widget Instructions with Authentic Briants Forest Green (#095f36) Styling
  const widgetRules = [];
  if (widgets.wantToKnowMore) {
    widgetRules.push(`- WANT TO KNOW MORE CALLOUT: At the end of the post, include an HTML callout box formatted EXACTLY as:\n<div class='callout-box want-to-know-more' style='background: #f0fdf4; border-left: 5px solid #095f36; border-radius: 8px; padding: 20px 24px; margin: 32px 0;'>\n  <h4 style='color: #095f36; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;'>💡 Want to Know More? Recommended Reading</h4>\n  <ul style='margin: 0; padding-left: 20px;'>\n    <li><a href='[Exact URL 1 from Bank]'>[Exact Anchor Title 1]</a></li>\n    <li><a href='[Exact URL 2 from Bank]'>[Exact Anchor Title 2]</a></li>\n  </ul>\n</div>`);
  }

  if (widgets.categorySpotlight) {
    widgetRules.push(`- CATEGORY SPOTLIGHT BANNER: Include a CTA banner card formatted EXACTLY as:\n<div class='category-spotlight-box' style='background: #f0fdf4; border: 2px solid #095f36; border-radius: 12px; padding: 28px 24px; margin: 36px 0; text-align: center; color: #111827; box-shadow: 0 4px 16px rgba(9, 95, 54, 0.18);'>\n  <h3 style='color: #095f36; font-size: 22px; font-weight: 700; margin: 0 0 10px 0;'>Explore STIHL Range at Briants of Risborough</h3>\n  <p style='color: #374151; font-size: 14px; margin: 0 0 20px 0; line-height: 1.6;'>Discover our full range of domestic & professional garden machinery with local workshop service.</p>\n  <a href='${siteDomain}/product-category/brand/stihl/' class='spotlight-btn' style='display: inline-block; background: #095f36; color: #ffffff; font-weight: 700; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 15px;'>Shop STIHL Range &rarr;</a>\n</div>`);
  }

  if (widgets.table) {
    widgetRules.push(`- DATA & COMPARISON TABLE: Include at least one structured HTML <table> with <thead>, <tr>, <th> headers, and <tbody> data rows for maintenance tasks or specs.`);
  }

  const widgetSection = widgetRules.length > 0
    ? `\n### Mandatory HTML Widgets:\n${widgetRules.join("\n")}\n`
    : "";

  const inlineImagesRule = Number(imageCount) > 0
    ? `Insert exactly ${imageCount} inline image placeholders formatted as {{IMAGE:keyword}} (e.g. {{IMAGE:chainsaw}}) inside content_html.`
    : `Do NOT insert any inline {{IMAGE:keyword}} placeholders. A featured cover image will be assigned automatically.`;

  return `SYSTEM INSTRUCTION: Act as an expert SEO Content Strategist and Copywriter for Briants of Risborough (${siteDomain}). Write a high-ranking, beautifully formatted blog post based on the specifications below.

CRITICAL FORMATTING REQUIREMENT: Wrap your entire JSON output inside a markdown \`\`\`json ... \`\`\` code block.

STRICT HTML RULES FOR content_html:
1. EVERY paragraph MUST be wrapped in separate <p>...</p> tags. Do NOT output plain text without <p> wrappers.
2. EVERY section heading MUST be wrapped in <h2>Heading Title</h2> or <h3>Heading Title</h3>.
3. EVERY link MUST be closed properly: <a href='https://...'>Anchor Phrase</a>. Never leave an <a> tag unclosed.
4. ALWAYS use single quotes for HTML attributes inside content_html (e.g. <a href='https://...'>).

---
### Blog Specifications:
- Topic / Title: "${topic}"
- Focus Keywords: ${keywords}
- Niche & Business Context: ${niche}
- Tone of Voice: ${tone}
- Target Word Count: ${wordCount}
- Inline Body Images Rule: ${inlineImagesRule}
${urlSection}${widgetSection}
---
### Output Schema (STRICT JSON ONLY):
Return ONLY a valid JSON object matching this schema:
{
  "title": "SEO Optimized Article Title",
  "slug": "url-friendly-slug",
  "categories": ["Garden Machinery", "STIHL"],
  "tags": ["stihl chainsaw", "buying guide"],
  "yoast_meta_title": "Meta Title under 60 chars",
  "yoast_meta_desc": "Engaging meta description under 155 chars with focus keyword",
  "content_html": "Full article HTML with <p>, <h2>, <h3>, <table>, hyperlinks, and widgets..."
}`;
}
