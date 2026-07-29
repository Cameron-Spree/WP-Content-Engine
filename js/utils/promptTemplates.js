/**
 * AI System Prompt Generator Template
 * Generates copyable, strict-schema instructions for ChatGPT / Claude / Gemini
 */

export function generateAIPrompt(params) {
  const {
    topic = "The Ultimate Guide to Modern SEO",
    keywords = "wordpress, seo, marketing",
    niche = "Digital Marketing",
    tone = "Authoritative, professional, & actionable",
    urls = "",
    wordCount = "1200-1800 words",
    imageCount = "2 to 4"
  } = params;

  const urlListFormatted = urls
    .split("\n")
    .map(u => u.trim())
    .filter(u => u.length > 0)
    .map(u => `- ${u}`)
    .join("\n");

  const urlSection = urlListFormatted
    ? `\n### Internal Link Target Pool:\nWhenever natural and relevant, seamlessly hyperlink appropriate anchor phrases in the text to these URLs:\n${urlListFormatted}\n`
    : "";

  return `SYSTEM INSTRUCTION: Act as an expert SEO Content Strategist and WordPress Specialist. Write a comprehensive, high-ranking blog post based on the specifications below.

CRITICAL REQUIREMENT: You MUST respond ONLY with a raw, valid JSON object (or a JSON array of post objects if generating multiple posts). Do NOT wrap your response in markdown code blocks like \`\`\`json. Output raw JSON only.

---
### Blog Specifications:
- Topic / Title: "${topic}"
- Target Keywords: ${keywords}
- Site Niche / Domain: ${niche}
- Brand Tone: ${tone}
- Target Length: ${wordCount}
- Image Placeholders: Insert ${imageCount} image tags formatted as {{IMAGE:keyword}} inside content_html.
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
  "content_html": "<p>Intro paragraph...</p><h2>Subheading</h2><p>Paragraph with {{IMAGE:keyword}} placeholder...</p><table><thead><tr><th>Col 1</th><th>Col 2</th></tr></thead><tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody></table>",
  "image_placeholders": ["keyword1", "keyword2"]
}

---
### Formatting & Quality Rules for content_html:
1. Use semantic HTML tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <blockquote>.
2. Include at least one structured HTML table or bulleted list for reader scannability.
3. Insert image placeholders in the format {{IMAGE:keyword}} (e.g. {{IMAGE:seo}}, {{IMAGE:analytics}}) directly inside <p> or as standalone elements. Use lowercase single-word tags for keywords.
4. Ensure content is 100% original, highly engaging, and provides actionable value.

Respond with ONLY the valid JSON object now:`;
}
