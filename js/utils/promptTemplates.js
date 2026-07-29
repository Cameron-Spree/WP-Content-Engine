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

/**
 * Generate Bulk Cluster Prompts (for rapid 5-10 article cluster generation)
 */
export function generateBulkClusterPrompts(params) {
  const {
    clusterTopic = "STIHL Garden Machinery & Power Tools",
    questions = [],
    niche = "Briants of Risborough - Garden Machinery & Tools",
    tone = "Authoritative, practical, & expert guidance",
    wordCount = "800-1200 words",
    linksBank = [],
    siteDomain = "https://briantsofrisborough.co.uk",
    blogSubpath = "/blog/"
  } = params;

  if (!questions || questions.length === 0) return [];

  // Build cluster URLs mapping so prompts cross-link all articles in the cluster
  const clusterLinks = questions.map(q => {
    const slug = String(q).toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
    const fullUrl = `${siteDomain.replace(/\/$/, "")}${blogSubpath}${slug}`;
    return { title: q.trim(), url: fullUrl };
  });

  return questions.map((q, idx) => {
    const otherClusterArticles = clusterLinks
      .filter((_, i) => i !== idx)
      .map(c => `- ${c.url} (Cluster Article: "${c.title}")`);

    const masterLinks = linksBank.map(item => {
      if (item.url && item.label) return `- ${item.url} (Anchor Text: "${item.label}")`;
      return `- ${item}`;
    });

    const allLinksText = [...masterLinks, ...otherClusterArticles].join("\n");

    const promptText = `SYSTEM INSTRUCTION: Act as an expert SEO Copywriter for Briants of Risborough (${siteDomain}). Write Cluster Article #${idx + 1} of ${questions.length} in the "${clusterTopic}" cluster.

CRITICAL FORMATTING REQUIREMENT: Wrap your entire JSON output inside a markdown \`\`\`json ... \`\`\` code block.

STRICT HTML RULES FOR content_html:
1. EVERY paragraph MUST be wrapped in separate <p>...</p> tags.
2. EVERY section heading MUST be wrapped in <h2>Heading Title</h2> or <h3>Heading Title</h3>.
3. EVERY link MUST be closed properly: <a href='https://...'>Anchor Phrase</a>.
4. ALWAYS use single quotes for HTML attributes inside content_html.

---
### Article Specifications:
- Article Title / Question: "${q.trim()}"
- Cluster Topic: "${clusterTopic}"
- Site Niche / Domain: ${niche}
- Brand Tone: ${tone}
- Target Word Count: ${wordCount}

### Target Internal Links (Contextual Cross-Linking Mandate):
${allLinksText}

### Mandatory HTML Callout Widget:
At the end of the post, include an HTML callout box formatted EXACTLY as:
<div class='callout-box want-to-know-more'>
  <h4>💡 Want to Know More? Recommended Reading</h4>
  <ul>
    <li><a href='[Internal Link URL 1]'>[Anchor Title 1]</a></li>
    <li><a href='[Internal Link URL 2]'>[Anchor Title 2]</a></li>
  </ul>
</div>

---
### Required JSON Format (Wrap in \`\`\`json):
\`\`\`json
{
  "title": "${q.trim().replace(/"/g, '\\"')}",
  "slug": "${clusterLinks[idx].url.split('/').pop()}",
  "categories": ["Garden Machinery", "STIHL"],
  "tags": ["stihl", "garden machinery", "briants of risborough"],
  "yoast_meta_title": "${q.trim().substring(0, 50)} | Briants of Risborough",
  "yoast_meta_desc": "Discover expert advice on ${q.trim().toLowerCase()} from Briants of Risborough.",
  "content_html": "<p>Content HTML wrapped in <p> and <h2> tags...</p><div class='callout-box want-to-know-more'>...</div>"
}
\`\`\`

Respond with the \`\`\`json block now:`;

    return {
      index: idx + 1,
      title: q.trim(),
      prompt: promptText
    };
  });
}
