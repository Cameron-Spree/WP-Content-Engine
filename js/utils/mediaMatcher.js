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
    const titleNouns = extractSmartMediaKeywords(post.title);

    let bestScore = 0;
    let bestMatch = null;

    imagePool.forEach(img => {
      let score = 0;
      const imgText = `${img.title || ''} ${img.filename || ''} ${(img.tags || []).join(' ')}`.toLowerCase();

      titleNouns.forEach((noun, idx) => {
        if (imgText.includes(noun)) {
          // Extra weight for subject nouns
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
