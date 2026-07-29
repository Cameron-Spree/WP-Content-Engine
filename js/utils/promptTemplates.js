/**
 * AI System Prompt Generator Template (Briants of Risborough Edition)
 * Automatically injects internal links bank & queued batch post URLs
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
    blogSubpath = "/blog/"
  } = params;

  // Build Internal Links Target Pool
  const allInternalTargets = [];

  // 1. Site Links Bank
  linksBank.forEach(item => {
    if (item.url && item.label) {
      allInternalTargets.push(`- ${item.url} (Anchor Context: "${item.label}")`);
    } else if (typeof item === "string" && item.trim()) {
      allInternalTargets.push(`- ${item.trim()}`);
    }
  });

  // 2. Queued Batch Posts URLs (Cross-linking)
  queuedBatchPosts.forEach(post => {
    const fullBlogUrl = `${siteDomain.replace(/\/$/, "")}${blogSubpath}${post.slug.replace(/^\//, "")}`;
    allInternalTargets.push(`- ${fullBlogUrl} (Batch Blog Post: "${post.title}")`);
  });

  const urlSection = allInternalTargets.length > 0
    ? `\n### Target Internal Links Bank (Contextual Linking Mandate):\nWhenever natural and relevant to the topic, seamlessly hyperlink appropriate anchor phrases inside paragraphs to these internal URLs:\n${allInternalTargets.join("\n")}\n`
    : "";

  const inlineImagesRule = Number(imageCount) > 0
    ? `Insert exactly ${imageCount} inline image tag placeholders formatted as {{IMAGE:keyword}} (e.g. {{IMAGE:chainsaw}}, {{IMAGE:lawnmower}}) inside content_html.`
    : `Do NOT insert any inline {{IMAGE:keyword}} placeholders inside content_html. A single featured cover image will be assigned automatically for the blog post listing.`;

  return `SYSTEM INSTRUCTION: Act as an expert SEO Content Strategist and Copywriter for Briants of Risborough (${siteDomain}). Write a high-ranking, highly engaging blog post based on the specifications below.

CRITICAL REQUIREMENT: You MUST respond ONLY with a raw, valid JSON object (or a JSON array of post objects if generating multiple posts). Do NOT wrap your response in markdown code blocks like \`\`\`json. Output raw JSON only.

---
### Blog Specifications:
- Topic / Title: "${topic}"
- Target Keywords: ${keywords}
- Site Niche / Domain: ${niche}
- Brand Tone: ${tone}
- Target Word Count: ${wordCount}
- Image Rule: ${inlineImagesRule}
${urlSection}

---
### Required JSON Schema:
{
  "title": "Full Catchy Post Title",
  "slug": "url-friendly-slug-with-hyphens",
  "categories": ["Category 1", "Category 2"],
  "tags": ["tag1", "tag2", "tag3"],
  "yoast_meta_title": "SEO Title (strictly max 60 characters)",
  "yoast_meta_desc": "Compelling SEO meta description with target keyword (strictly max 155 characters)",
  "content_html": "<p>Intro paragraph with <a href=\\"${siteDomain}/garden-machinery\\">internal link anchor</a>...</p><h2>Subheading</h2><p>Paragraph text...</p><table><thead><tr><th>Feature</th><th>Recommendation</th></tr></thead><tbody><tr><td>Model</td><td>STIHL MS 180</td></tr></tbody></table>"
}

---
### Formatting & Quality Rules for content_html:
1. Use semantic HTML tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <blockquote>.
2. Include at least one structured HTML table or bulleted list for scannability.
3. Naturally incorporate contextual internal links from the Target Internal Links Bank above.
4. Ensure content is 100% original, practical, and tailored for UK garden machinery & power tool customers.

Respond with ONLY the valid JSON object now:`;
}
