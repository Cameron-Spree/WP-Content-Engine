/**
 * WP Content Engine - Debug Logger & Performance Diagnostic Tool
 */

const logs = [];
const errors = [];
const apiLogs = [];
const imgErrorLogs = [];

export function recordApiLog(action, status, detail) {
  const logObj = {
    time: new Date().toLocaleTimeString(),
    action,
    status,
    detail
  };
  apiLogs.push(logObj);
  logs.push({
    type: `API_${action}`,
    time: logObj.time,
    message: `[${status}] ${detail}`
  });
}

export function recordImageError(imgId, src, errorMsg) {
  const errObj = {
    time: new Date().toLocaleTimeString(),
    imgId,
    src,
    errorMsg: errorMsg || "Failed to render <img> src"
  };
  imgErrorLogs.push(errObj);
  logs.push({
    type: "IMAGE_RENDER_ERROR",
    time: errObj.time,
    message: `[${imgId}] ${src}`
  });
}

// Intercept window errors and unhandled rejections
window.addEventListener("error", (event) => {
  const errObj = {
    type: "ERROR",
    time: new Date().toLocaleTimeString(),
    message: event.message || "Script Error",
    filename: event.filename || "unknown",
    lineno: event.lineno,
    colno: event.colno
  };
  errors.push(errObj);
  logs.push(errObj);
});

window.addEventListener("unhandledrejection", (event) => {
  const errObj = {
    type: "UNHANDLED PROMISE REJECTION",
    time: new Date().toLocaleTimeString(),
    reason: String(event.reason || "Unknown Rejection")
  };
  errors.push(errObj);
  logs.push(errObj);
});

const origError = console.error;
console.error = function(...args) {
  errors.push({
    type: "CONSOLE_ERROR",
    time: new Date().toLocaleTimeString(),
    message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ")
  });
  origError.apply(console, args);
};

const origWarn = console.warn;
console.warn = function(...args) {
  logs.push({
    type: "CONSOLE_WARN",
    time: new Date().toLocaleTimeString(),
    message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ")
  });
  origWarn.apply(console, args);
};

export function getDiagnosticReport(state) {
  const perfEntries = (performance && performance.getEntriesByType) ? performance.getEntriesByType("resource") : [];
  const navigationEntry = (performance && performance.getEntriesByType) ? performance.getEntriesByType("navigation")[0] : null;

  let storageBytes = 0;
  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        storageBytes += ((localStorage[key] || '').length + key.length) * 2;
      }
    }
  } catch (e) {}

  const storageMb = (storageBytes / (1024 * 1024)).toFixed(2);

  const rawInputEl = document.getElementById("raw-json-input");
  const currentTab2RawInput = rawInputEl ? rawInputEl.value : "";

  const imagePoolSamples = (state && state.imagePool) ? state.imagePool.map(img => ({
    id: img.id,
    wpMediaId: img.wpMediaId,
    title: img.title,
    filename: img.filename,
    url: img.url,
    tags: img.tags
  })) : [];

  const postQueueSamples = (state && state.posts) ? state.posts.map((p, i) => ({
    queueIndex: i + 1,
    id: p.id,
    title: p.title,
    slug: p.slug,
    hasFeaturedImage: Boolean(p.featured_image),
    featuredImageTitle: p.featured_image ? p.featured_image.title : "None",
    featuredImageUrl: p.featured_image ? (p.featured_image.previewUrl || p.featured_image.url) : "None",
    isFeaturedManual: Boolean(p.featured_image_manual),
    imagePlaceholders: p.image_placeholders || [],
    mappedImages: p.mapped_images ? Object.entries(p.mapped_images).map(([kw, img]) => ({
      placeholder: kw,
      mappedId: img ? img.id : "None",
      mappedTitle: img ? img.title : "None",
      mappedUrl: img ? img.url : "None"
    })) : [],
    contentHtmlSnippet: (p.content_html || "").substring(0, 300) + "..."
  })) : [];

  const slowResources = perfEntries
    .filter(entry => entry.duration > 800)
    .map(entry => ({
      name: entry.name.split('?')[0].split('/').pop() || entry.name,
      fullUrl: entry.name,
      type: entry.initiatorType,
      durationMs: Math.round(entry.duration),
      transferBytes: entry.transferSize
    }));

  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    onlineStatus: navigator.onLine ? "Online" : "Offline",
    localStorageUsedMb: `${storageMb} MB / ~5.00 MB`,
    navigationTiming: navigationEntry ? {
      domInteractiveMs: Math.round(navigationEntry.domInteractive),
      domCompleteMs: Math.round(navigationEntry.domComplete),
      loadEventEndMs: Math.round(navigationEntry.loadEventEnd)
    } : null,
    postsCount: state ? (state.posts || []).length : 0,
    mediaPoolCount: state ? (state.imagePool || []).length : 0,
    tab2CurrentRawJsonSnippet: currentTab2RawInput ? currentTab2RawInput.substring(0, 500) : "Empty",
    postQueueInspectorSamples: postQueueSamples,
    imagePoolInspectorSamples: imagePoolSamples.slice(0, 10),
    imageRenderErrorLogs: imgErrorLogs,
    wpApiConfigured: Boolean(state && state.settings && state.settings.wpUsername && state.settings.wpAppPassword),
    wordpressApiActivityLogs: apiLogs,
    totalResourcesLoaded: perfEntries.length,
    slowOrFailedResourcesCount: slowResources.length,
    slowResources: slowResources,
    recordedErrorsCount: errors.length,
    recordedErrors: errors,
    recentLogs: logs.slice(-30)
  };
}
