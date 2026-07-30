/**
 * WP Content Engine - Debug Logger & Performance Diagnostic Tool
 */

const logs = [];
const errors = [];
const apiLogs = [];

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

// Intercept console.warn and console.error
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

  // Calculate localStorage usage
  let storageBytes = 0;
  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        storageBytes += ((localStorage[key] || '').length + key.length) * 2;
      }
    }
  } catch (e) {}

  const storageMb = (storageBytes / (1024 * 1024)).toFixed(2);

  // Slow or stuck resources (>800ms)
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
    wpApiConfigured: Boolean(state && state.settings && state.settings.wpUsername && state.settings.wpAppPassword),
    wpUsernameSet: Boolean(state && state.settings && state.settings.wpUsername),
    wpAppPassLength: (state && state.settings && state.settings.wpAppPassword) ? state.settings.wpAppPassword.length : 0,
    wordpressApiActivityLogs: apiLogs,
    totalResourcesLoaded: perfEntries.length,
    slowOrFailedResourcesCount: slowResources.length,
    slowResources: slowResources,
    recordedErrorsCount: errors.length,
    recordedErrors: errors,
    recentLogs: logs.slice(-25)
  };
}
