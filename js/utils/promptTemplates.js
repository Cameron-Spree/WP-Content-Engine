/**
 * AI System Prompt Generator Template (Briants of Risborough Edition)
 * Formatted with ```json code blocks and strict HTML widget schema
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

  // Widget Instructions
  const widgetRules = [];
  if (widgets.wantToKnowMore) {
    widgetRules.push(`- WANT TO KNOW MORE CALLOUT: At the end of the post, include an HTML callout box formatted EXACTLY as:\n<div class='callout-box want-to-know-more'>\n  <h4>💡 Want to Know More? Recommended Reading</h4>\n  <ul>\n    <li><a href='[Exact URL 1 from Bank]'>[Exact Anchor Title 1]</a></li>\n    <li><a href='[Exact URL 2 from Bank]'>[Exact Anchor Title 2]</a></li>\n  </ul>\n</div>`);
  }

  if (widgets.categorySpotlight) {
    widgetRules.push(`- CATEGORY SPOTLIGHT BANNER: Include a CTA banner card formatted EXACTLY as:\n<div class='category-spotlight-box'>\n  <h3>Explore STIHL Range at Briants of Risborough</h3>\n  <p>Discover our full range of domestic & professional garden machinery with local workshop service.</p>\n  <a href='${siteDomain}/product-category/brand/stihl/' class='spotlight-btn'>Shop STIHL Range &rarr;</a>\n</div>`);
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
- Target Keywords: ${keywords}
- Site Niche / Domain: ${niche}
- Brand Tone: ${tone}
- Target Word Count: ${wordCount}
- Image Rule: ${inlineImagesRule}
${urlSection}${widgetSection}
---
### Required JSON Format (Wrap in \`\`\`json):
\`\`\`json
{
  "title": "Full Catchy Post Title",
  "slug": "url-friendly-slug-with-hyphens",
  "categories": ["Garden Machinery", "STIHL"],
  "tags": ["stihl garden machinery", "chainsaw maintenance"],
  "yoast_meta_title": "SEO Title (strictly max 60 characters)",
  "yoast_meta_desc": "SEO description with keyword (strictly max 155 characters)",
  "content_html": "<p>Intro paragraph with <a href='${siteDomain}/product-category/garden-machinery/'>Garden Machinery Range</a>...</p><h2>Selecting Equipment</h2><p>Paragraph text...</p><div class='callout-box want-to-know-more'><h4>💡 Want to Know More? Recommended Reading</h4><ul><li><a href='${siteDomain}/product-category/garden-machinery/chainsaws/'>STIHL Chainsaws Range</a></li></ul></div>"
}
\`\`\`

Respond with the \`\`\`json block now:`;
}
