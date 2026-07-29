/**
 * Smart Media Matcher & Asset Resolver for WP Content Engine
 */

export function autoMatchPostMedia(post, imagePool) {
  if (!imagePool || imagePool.length === 0) {
    return post;
  }

  const mappedImages = {};
  const placeholders = post.image_placeholders || [];

  placeholders.forEach(keyword => {
    const kwLower = keyword.toLowerCase().trim();
    
    // Find image whose tags include this keyword
    const matchedImage = imagePool.find(img => 
      img.tags.some(tag => tag.toLowerCase().trim() === kwLower)
    );

    if (matchedImage) {
      mappedImages[keyword] = matchedImage;
    } else {
      // Fallback: match by partial tag or title, or fallback to first image in pool
      const partialMatch = imagePool.find(img => 
        img.tags.some(tag => tag.toLowerCase().includes(kwLower) || kwLower.includes(tag.toLowerCase())) ||
        img.title.toLowerCase().includes(kwLower)
      );
      mappedImages[keyword] = partialMatch || imagePool[0];
    }
  });

  // Assign featured image if not explicitly set
  let featuredImage = null;
  if (post.featured_image_id) {
    featuredImage = imagePool.find(img => img.id === post.featured_image_id);
  }

  if (!featuredImage) {
    // Try matching post category or post title tags against image pool
    const postTags = [...post.categories, ...post.tags].map(t => t.toLowerCase());
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

/**
 * Replaces {{IMAGE:keyword}} in content HTML with actual HTML img tags linked to resolved image URLs
 */
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
    .replace(/>/g, '&gt;');
}
