/**
 * Smart Media Matcher & Universal Noun Extractor for WP Content Engine
 * Filters out verbs, adjectives, filler words, and structural blog terms across any niche.
 */

// Universal Non-Noun Exclusion Set (Verbs, Adjectives, Pronouns, Conjunctions, Meta Fillers)
const NON_NOUNS = new Set([
  // Auxiliary & Action Verbs
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "need", "needs", "needed", "needing", "know", "knows", "knew", "knowing", "want", "wants", "wanted",
  "get", "gets", "got", "getting", "make", "makes", "made", "making", "take", "takes", "took", "taking",
  "can", "could", "will", "would", "should", "shall", "may", "might", "must", "choose", "choosing", "chose",
  "buy", "buying", "bought", "sell", "selling", "sold", "use", "using", "used", "work", "working", "worked",
  "run", "running", "ran", "fix", "fixing", "fixed", "clean", "cleaning", "cleaned", "maintain", "maintaining",
  "look", "looking", "looked", "see", "seeing", "saw", "find", "finding", "found", "start", "starting",
  "stop", "stopping", "help", "helps", "helped", "helping", "give", "gives", "gave", "keep", "keeping",
  "think", "thinking", "thought", "try", "trying", "tried", "learn", "learning", "learned", "understand",

  // Adjectives & Quality Descriptors
  "ultimate", "best", "top", "great", "good", "bad", "easy", "hard", "simple", "complete", "full",
  "essential", "perfect", "ideal", "right", "wrong", "new", "old", "first", "last", "cheap", "expensive",
  "quick", "fast", "slow", "safe", "safely", "high", "low", "big", "small", "large", "huge", "smart",

  // Pronouns, Prepositions, Conjunctions & Question Words
  "what", "why", "when", "where", "how", "who", "which", "whose", "whom",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "her", "its", "our", "their", "this", "that", "these", "those",
  "with", "without", "from", "into", "onto", "upon", "about", "above", "below", "under", "over",
  "and", "but", "or", "nor", "so", "yet", "for", "against", "between", "through", "after", "before",

  // Meta Blog / Structural Fillers
  "guide", "guides", "tutorial", "tutorials", "tip", "tips", "trick", "tricks", "article", "articles",
  "post", "posts", "blog", "blogs", "review", "reviews", "overview", "everything", "anything", "nothing",
  "something", "versus", "comparison", "checklist", "way", "ways", "thing", "things"
]);

export function extractSmartMediaKeywords(titleText) {
  if (!titleText) return [];

  const cleanText = titleText.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = cleanText.split(/\s+/).filter(w => w.length > 2);

  // Filter out non-noun verbs, adjectives, and filler words while preserving natural title word order
  const extractedNouns = words.filter(w => !NON_NOUNS.has(w));

  return Array.from(new Set(extractedNouns));
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

export function autoMatchPostMedia(post, imagePool, settings, manualBodyImgIds = []) {
  if (!imagePool || imagePool.length === 0) {
    return post;
  }

  // Track used images so featured cover & body placeholders get unique, distinct images!
  const usedImageIds = new Set();

  // Assign featured image based on Title-Keyword Matching algorithm (preserving explicit user selections)
  let featuredImage = post.featured_image || null;
  if (!featuredImage && post.featured_image_id) {
    featuredImage = imagePool.find(img => img.id === post.featured_image_id || String(img.wpMediaId) === String(post.featured_image_id));
  }

  if (!featuredImage && post.title) {
    const titleNouns = extractSmartMediaKeywords(post.title);

    let bestScore = 0;
    let bestMatch = null;

    imagePool.forEach(img => {
      let score = 0;
      const imgText = `${img.title || ''} ${img.filename || ''} ${(img.tags || []).join(' ')}`.toLowerCase();

      titleNouns.forEach((noun, idx) => {
        if (imgText.includes(noun)) {
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
    ) || imagePool[0];
  }

  if (featuredImage && featuredImage.id) {
    usedImageIds.add(featuredImage.id);
  }

  // Match body placeholders ensuring distinct images for each placeholder
  const mappedImages = post.mapped_images ? { ...post.mapped_images } : {};
  const placeholders = post.image_placeholders || [];

  placeholders.forEach((keyword, idx) => {
    const kwLower = keyword.toLowerCase().trim();
    let matchedImage = null;
    
    // 0. User explicit manual body image selection for this slot
    if (manualBodyImgIds && manualBodyImgIds[idx]) {
      const explicitImg = imagePool.find(img => img.id === manualBodyImgIds[idx]);
      if (explicitImg && !usedImageIds.has(explicitImg.id)) {
        matchedImage = explicitImg;
      }
    }

    // 1. Exact tag match not used yet
    if (!matchedImage) {
      matchedImage = imagePool.find(img => 
        !usedImageIds.has(img.id) && img.tags.some(tag => tag.toLowerCase().trim() === kwLower)
      );
    }

    // 2. Partial match not used yet
    if (!matchedImage) {
      matchedImage = imagePool.find(img => 
        !usedImageIds.has(img.id) && (
          img.tags.some(tag => tag.toLowerCase().includes(kwLower) || kwLower.includes(tag.toLowerCase())) ||
          (img.title && img.title.toLowerCase().includes(kwLower))
        )
      );
    }

    // 3. Distinct fallback: pick unique unused image from pool
    if (!matchedImage) {
      const unusedPool = imagePool.filter(img => !usedImageIds.has(img.id));
      matchedImage = unusedPool.length > 0 ? unusedPool[idx % unusedPool.length] : imagePool[(idx + 1) % imagePool.length];
    }

    if (matchedImage) {
      if (matchedImage.id) usedImageIds.add(matchedImage.id);
      mappedImages[keyword] = matchedImage;
    }
  });

  return {
    ...post,
    featured_image_id: featuredImage ? featuredImage.id : null,
    featured_image: featuredImage,
    mapped_images: mappedImages
  };
}

export function replaceImagePlaceholdersInHtml(contentHtml, mappedImages, imagePool, getSafeDisplayUrlFn = null) {
  if (!contentHtml) return "";

  // Universal regex matching any placeholder format including spaces (e.g. {{IMAGE:grass strimmer}})
  let html = contentHtml.replace(/\{\{IMAGE:([^}]+)\}\}/gi, (match, kw) => {
    const rawKw = kw.trim();
    const kwLower = rawKw.toLowerCase();

    // 1. Direct dictionary match
    let img = mappedImages ? (mappedImages[kwLower] || mappedImages[rawKw]) : null;

    // 2. Search imagePool by tag, title, or filename
    if (!img && imagePool && imagePool.length > 0) {
      img = imagePool.find(i => 
        (i.tags && i.tags.some(t => t.toLowerCase() === kwLower)) ||
        (i.title && i.title.toLowerCase().includes(kwLower)) ||
        (i.filename && i.filename.toLowerCase().includes(kwLower))
      );

      // Fallback: partial word match
      if (!img) {
        const kwWords = kwLower.split(/\s+/).filter(w => w.length > 2);
        img = imagePool.find(i => {
          const imgText = `${i.title || ''} ${i.filename || ''} ${(i.tags || []).join(' ')}`.toLowerCase();
          return kwWords.some(w => imgText.includes(w));
        });
      }

      // Default fallback to 1st image in pool
      if (!img) img = imagePool[0];
    }

    if (img && img.url) {
      const displayUrl = getSafeDisplayUrlFn ? getSafeDisplayUrlFn(img) : img.url;
      return `<figure class="wp-block-image size-large is-resized aligncenter" style="margin:24px 0; text-align:center;"><img src="${escapeAttribute(displayUrl)}" alt="${escapeAttribute(img.title || rawKw)}" class="wp-image-${img.wpMediaId || ''}" style="width:100%; max-width:100%; max-height:480px; object-fit:cover; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.15);" /><figcaption style="font-size:12px; color:#888; margin-top:6px; font-style:italic;">${escapeHtml(img.title || rawKw)}</figcaption></figure>`;
    }

    return `<p><em>[Image Placeholder: ${escapeHtml(rawKw)}]</em></p>`;
  });

  // Proxy direct <img src="..."> tags for live preview containers if getSafeDisplayUrlFn is provided
  if (getSafeDisplayUrlFn) {
    html = html.replace(/src=["'](https?:\/\/[^"']+)["']/gi, (match, url) => {
      const safeUrl = getSafeDisplayUrlFn(url);
      return `src="${escapeAttribute(safeUrl)}"`;
    });
  }

  return html;
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
