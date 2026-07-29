/**
 * Sample Data for WP Content Engine
 * Pre-populates media pool and queued posts for instant testing & demonstration.
 */

export const SAMPLE_IMAGE_POOL = [
  {
    id: "img_1",
    url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    title: "SEO Analytics & Dashboard Graphs",
    tags: ["seo", "analytics", "marketing", "dashboard"]
  },
  {
    id: "img_2",
    url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    title: "Developer Coding Laptop Setup",
    tags: ["wordpress", "code", "laptop", "tech", "development"]
  },
  {
    id: "img_3",
    url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
    title: "Modern Office Strategy Meeting",
    tags: ["strategy", "business", "growth", "team"]
  },
  {
    id: "img_4",
    url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    title: "Data Visualization & Metrics Screen",
    tags: ["data", "metrics", "speed", "performance"]
  }
];

export const SAMPLE_POST_PAYLOADS = [
  {
    title: "The Ultimate Guide to Modern WordPress SEO in 2026",
    slug: "ultimate-guide-modern-wordpress-seo-2026",
    categories: ["WordPress", "SEO & Marketing"],
    tags: ["seo", "yoast", "schema", "performance"],
    yoast_meta_title: "WordPress SEO Guide 2026: Boost Rankings & Traffic",
    yoast_meta_desc: "Master modern WordPress SEO with our complete 2026 guide covering Yoast setup, schema markup, Core Web Vitals, and internal linking strategies.",
    content_html: `
<p>Search engine optimization (SEO) for WordPress has evolved dramatically. Today's search algorithms prioritize technical excellence, structured data, and rich multimedia experiences.</p>

<h2>1. Optimizing Core Web Vitals & Site Speed</h2>
<p>Page load speed remains a crucial ranking factor. Implementing server-side caching and CDN distribution ensures high Core Web Vitals scores.</p>
<p>{{IMAGE:performance}}</p>

<h2>2. Leveraging Yoast SEO & Schema Markup</h2>
<p>Properly configuring Yoast SEO allows your site to communicate metadata clearly to search crawlers. Here is a breakdown of essential configuration steps:</p>

<table>
  <thead>
    <tr>
      <th>SEO Component</th>
      <th>Recommended Target</th>
      <th>Impact Level</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Meta Title</td>
      <td>50 - 60 Characters</td>
      <td>High</td>
    </tr>
    <tr>
      <td>Meta Description</td>
      <td>120 - 155 Characters</td>
      <td>Medium</td>
    </tr>
    <tr>
      <td>Structured Schema</td>
      <td>Article / BlogPosting JSON-LD</td>
      <td>Critical</td>
    </tr>
  </tbody>
</table>

<p>{{IMAGE:seo}}</p>

<h2>3. Building High-Intent Content & Internal Links</h2>
<p>For more strategies on performance tuning, check out our guide on <a href="https://mysite.com/blog/speed-optimization">WordPress Speed Optimization</a>.</p>
`,
    image_placeholders: ["performance", "seo"]
  },
  {
    title: "10 Proven Content Marketing Strategies for Explosive Growth",
    slug: "10-proven-content-marketing-strategies",
    categories: ["Content Strategy", "Digital Marketing"],
    tags: ["content", "growth", "strategy", "analytics"],
    yoast_meta_title: "10 Proven Content Marketing Strategies (2026 Growth Guide)",
    yoast_meta_desc: "Discover 10 actionable content marketing tactics to scale your organic audience, increase brand authority, and convert visitors into loyal customers.",
    content_html: `
<p>Content marketing is no longer just about publishing blog posts—it is about delivering structured value across every stage of the customer journey.</p>

<h2>Scaling Your Publishing Workflow</h2>
<p>Consistency and editorial alignment drive domain authority. Automating your publishing pipeline frees up creative bandwidth.</p>
<p>{{IMAGE:strategy}}</p>

<h2>Data-Driven Audience Targeting</h2>
<p>Track metrics carefully to refine topic selection and keyword intent over time.</p>
<p>{{IMAGE:analytics}}</p>
`,
    image_placeholders: ["strategy", "analytics"]
  }
];
