/**
 * AI System Prompt Generator Template (Briants of Risborough Edition)
 * Formatted with HTML Widget Toggles & Strict Tag Closing Rules
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
      allInternalTargets.push(`- ${item.url} (Anchor Context: "${item.label}")`);
    } else if (typeof item === "string" && item.trim()) {
      allInternalTargets.push(`- ${item.trim()}`);
    }
  });

  queuedBatchPosts.forEach(post => {
    const fullBlogUrl = `${siteDomain.replace(/\/$/, "")}${blogSubpath}${post.slug.replace(/^\//, "")}`;
    allInternalTargets.push(`- ${fullBlogUrl} (Batch Blog Post: "${post.title}")`);
  });

  const urlSection = allInternalTargets.length > 0
    ? `\n### Target Internal Links Bank (Contextual Linking Mandate):\nWhenever natural and relevant to the topic, seamlessly hyperlink appropriate anchor phrases inside paragraphs to these internal URLs. MANDATORY RULE: Use single quotes for href attributes, e.g. <a href='https://...'>Anchor Text</a>.\n${allInternalTargets.join("\n")}\n`
    : "";

  // Widget Instructions
  const widgetRules = [];
  if (widgets.wantToKnowMore) {
    widgetRules.push(`- WANT TO KNOW MORE WIDGET: Include a callout block formatted exactly as:\n<div class='callout-box want-to-know-more'>\n  <h4>💡 Want to Know More? Recommended Reading</h4>\n  <ul>\n    <li><a href='[Internal Link URL]'>[Descriptive Related Article or Category Title]</a></li>\n    <li><a href='[Internal Link URL]'>[Descriptive Related Article or Category Title]</a></li>\n  </ul>\n</div>`);
  }

  if (widgets.categorySpotlight) {
    widgetRules.push(`- CATEGORY SPOTLIGHT CTA WIDGET: Include a banner card formatted exactly as:\n<div class='category-spotlight-box'>\n  <h3>Explore [Main Category Name] at Briants of Risborough</h3>\n  <p>[Brief compelling sentence recommending Briants garden machinery showroom & online store.]</p>\n  <a href='[Relevant Category URL from Bank]' class='spotlight-btn'>Shop [Category Name] Range &rarr;</a>\n</div>`);
  }

  if (widgets.table) {
    widgetRules.push(`- DATA & COMPARISON TABLE: Include at least one structured HTML <table> with <thead>, <tr>, <th> headers, and <tbody> table data rows summarizing specs, maintenance schedules, or product recommendations.`);
  }

  const widgetSection = widgetRules.length > 0
    ? `\n### Required HTML Widgets & Interactive Elements:\n${widgetRules.join("\n")}\n`
    : "";

  const inlineImagesRule = Number(imageCount) > 0
    ? `Insert exactly ${imageCount} inline image tag placeholders formatted as {{IMAGE:keyword}} (e.g. {{IMAGE:chainsaw}}, {{IMAGE:lawnmower}}) inside content_html.`
    : `Do NOT insert any inline {{IMAGE:keyword}} placeholders inside content_html. A single featured cover image will be assigned automatically for the blog post listing.`;

  return `SYSTEM INSTRUCTION: Act as an expert SEO Content Strategist and Copywriter for Briants of Risborough (${siteDomain}). Write a high-ranking, highly engaging blog post based on the specifications below.

CRITICAL REQUIREMENT: You MUST respond ONLY with a raw, valid JSON object. Do NOT wrap your response in markdown code blocks like \`\`\`json. Output raw JSON only.

STRICT HTML & JSON FORMATTING RULES:
1. MANDATORY LINK CLOSING: Every opened <a href='...'> tag MUST be closed </a> immediately after the anchor text. NEVER leave an anchor tag unclosed.
   - WRONG: <a href='https://...'>Anchor Phrase. The rest of the paragraph continues...
   - RIGHT: <a href='https://...'>Anchor Phrase</a>. The rest of the paragraph continues...
2. PARAGRAPH & HEADING SPACING:
   - EVERY paragraph MUST be wrapped in its own separate <p>...</p> tags.
   - EVERY section heading MUST be wrapped in <h2>Heading Title</h2> or <h3>Heading Title</h3>.
   - NEVER run headings and paragraph text together without HTML tags.
3. SINGLE QUOTES IN ATTRIBUTES: In content_html, ALWAYS use single quotes for HTML attributes (e.g. <a href='https://...'>Text</a>). Never use double quotes inside HTML string values.
4. Clean HTML links inside href attributes. Do NOT put markdown syntax like [url](url) inside href.

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
### Required JSON Schema:
{
  "title": "Full Catchy Post Title",
  "slug": "url-friendly-slug-with-hyphens",
  "categories": ["Category 1", "Category 2"],
  "tags": ["tag1", "tag2", "tag3"],
  "yoast_meta_title": "SEO Title (strictly max 60 characters)",
  "yoast_meta_desc": "Compelling SEO meta description with target keyword (strictly max 155 characters)",
  "content_html": "<p>Intro paragraph with <a href='${siteDomain}/product-category/garden-machinery/'>internal link anchor</a>...</p><h2>Subheading</h2><p>Paragraph text...</p><table><thead><tr><th>Feature</th><th>Recommendation</th></tr></thead><tbody><tr><td>Model</td><td>STIHL MS 180</td></tr></tbody></table><div class='callout-box want-to-know-more'><h4>💡 Want to Know More? Recommended Reading</h4><ul><li><a href='${siteDomain}/product-category/garden-machinery/chainsaws/'>STIHL Chainsaws Range</a></li></ul></div>"
}

---
### Formatting & Quality Rules for content_html:
1. Use semantic HTML tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <blockquote>.
2. Ensure every single <a href='...'> tag is properly closed with </a>.
3. Naturally incorporate contextual internal links from the Target Internal Links Bank using single quotes for hrefs.
4. Ensure content is 100% original, practical, and tailored for UK garden machinery & power tool customers.

Respond with ONLY the valid JSON object now:`;
}
