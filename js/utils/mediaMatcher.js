/**
 * Smart Media Matcher & WordPress Path Builder for WP Content Engine
 */

const PRODUCT_NOUNS = [
  "strimmer", "strimmers", "lawnmower", "lawnmowers", "chainsaw", "chainsaws",
  "brushcutter", "brushcutters", "hedgetrimmer", "hedgetrimmers", "blower", "blowers",
  "mower", "mowers", "imow", "stihl", "honda", "husqvarna", "viking", "mountfield",
  "hayter", "toro", "cub cadet", "countax", "atco", "karcher", "al-ko", "ego",
  "grass", "lawn", "hedge", "tree", "wood", "garden", "mulcher", "shredder",
  "scarifier", "tiller", "generator", "pressure washer", "robotic", "robot",
  "chaps", "helmet", "oil", "chain", "blade", "battery", "cordless", "petrol"
];

const STOP_WORDS = new Set([
  "what", "do", "does", "did", "need", "needs", "know", "about", "how", "to",
  "the", "and", "or", "for", "with", "your", "my", "our", "this", "that", "from",
  "why", "when", "where", "which", "who", "best", "top", "ultimate", "buying",
  "buyer", "buyers", "guide", "complete", "post", "blog", "everything", "should",
  "could", "would", "make", "take", "give", "help", "things", "ways", "tips",
  "tricks", "review", "reviews", "versus", "comparison", "essential"
]);

export function extractSmartMediaKeywords(titleText) {
  if (!titleText) return [];

  const cleanText = titleText.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = cleanText.split(/\s+/).filter(w => w.length > 2);

  // High-priority product nouns (e.g. strimmers, lawnmower, chainsaw)
  const matchedProducts = words.filter(w => PRODUCT_NOUNS.some(p => p === w || (w.length > 4 && (p.includes(w) || w.includes(p)))));

  // Filter out non-product stop words
  const cleanWords = words.filter(w => w.length > 3 && !STOP_WORDS.has(w));

  // Combine product nouns at the top
  const result = Array.from(new Set([...matchedProducts, ...cleanWords]));
  return result;
}

export function buildWpUploadUrl(filename, settings) {
  const domain = (settings && settings.domain) ? settings.domain.replace(/\/$/, "") : "https://briantsofrisborough.co.uk";
  const year = (settings && settings.uploadYear) ? settings.uploadYear : "2026";
  const month = (settings && settings.uploadMonth) ? settings.uploadMonth : "06";
  
  const cleanFilename = slugifyFilename(filename);
  return `${domain}/wp-content/uploads/${year}/${month}/${cleanFilename}`;
}

export function slugifyFilename(name) {
  if (!name) return "image.jpg";
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "jpg";
  const baseName = parts.join(".");

  const cleanBase = baseName
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return `${cleanBase || "image"}.${ext.toLowerCase()}`;
}

export function autoMatchPostMedia(post, imagePool, settings) {
  if (!imagePool || imagePool.length === 0) {
    return post;
  }

  const mappedImages = {};
  const placeholders = post.image_placeholders || [];

  placeholders.forEach(keyword => {
    const kwLower = keyword.toLowerCase().trim();
    
    const matchedImage = imagePool.find(img => 
      img.tags.some(tag => tag.toLowerCase().trim() === kwLower)
    );

    if (matchedImage) {
      mappedImages[keyword] = matchedImage;
    } else {
      const partialMatch = imagePool.find(img => 
        img.tags.some(tag => tag.toLowerCase().includes(kwLower) || kwLower.includes(tag.toLowerCase())) ||
        (img.title && img.title.toLowerCase().includes(kwLower))
      );
      mappedImages[keyword] = partialMatch || imagePool[0];
    }
  });

  // Assign featured image based on Title-Keyword Matching algorithm (preserving explicit user selections)
  let featuredImage = post.featured_image || null;
  if (!featuredImage && post.featured_image_id) {
    featuredImage = imagePool.find(img => img.id === post.featured_image_id || String(img.wpMediaId) === String(post.featured_image_id));
  }

  if (!featuredImage && post.title) {
    const titleWords = extractSmartMediaKeywords(post.title);

    let bestScore = 0;
    let bestMatch = null;

    imagePool.forEach(img => {
      let score = 0;
      const imgText = `${img.title || ''} ${img.filename || ''} ${(img.tags || []).join(' ')}`.toLowerCase();

      titleWords.forEach((word, idx) => {
        if (imgText.includes(word)) {
          // Extra weight for product nouns matched near beginning
          score += (idx === 0 ? 5 : 2);
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = img;
      }
    });

    if (bestMatch && bestScore > 0) {
      featuredImage = bestMatch;
    }
  }

  if (!featuredImage) {
    const postTags = [...(post.categories || []), ...(post.tags || [])].map(t => t.toLowerCase());
    featuredImage = imagePool.find(img => 
      img.tags.some(tag => postTags.includes(tag.toLowerCase()))
    ) || (Object.values(mappedImages)[0]) || imagePool[0];
  }

  return {
    ...post,
    featured_image_id: featuredImage ? featuredImage.id : null,
    featured_image: featuredImage,
    mapped_images: mappedImages
  };
}

export function replaceImagePlaceholdersInHtml(contentHtml, mappedImages, imagePool) {
  if (!contentHtml) return "";

  return contentHtml.replace(/\{\{IMAGE:([a-zA-Z0-9_-]+)\}\}/g, (match, kw) => {
    const kwLower = kw.toLowerCase();
    let img = mappedImages ? mappedImages[kwLower] : null;

    if (!img && imagePool && imagePool.length > 0) {
      img = imagePool.find(i => i.tags.some(t => t.toLowerCase() === kwLower)) || imagePool[0];
    }

    if (img && img.url) {
      return `<figure class="wp-block-image size-full"><img src="${escapeAttribute(img.url)}" alt="${escapeAttribute(img.title || kw)}" class="wp-image-asset" /><figcaption>${escapeHtml(img.title || kw)}</figcaption></figure>`;
    }

    return `<p><em>[Image Placeholder: ${kw}]</em></p>`;
  });
}

function escapeAttribute(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
