/**
 * WordPress REST API Sync Utility
 * Uploads media files & updates media metadata directly in WordPress wp-json/wp/v2/media
 */

import { recordApiLog } from "./debugLogger.js";

export async function uploadImageToWordPress(file, settings) {
  if (!settings || !settings.wpUsername || !settings.wpAppPassword) {
    recordApiLog("WP_UPLOAD", "FAILED", "Missing username or application password");
    return { success: false, error: "Missing WordPress credentials in Settings" };
  }

  const domain = (settings.domain || "https://briantsofrisborough.co.uk").replace(/\/$/, "");
  const targetUrl = `${domain}/wp-json/wp/v2/media`;

  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);

  // Helper function to perform fetch with optional CORS proxy wrapper
  const doFetch = async (url, useProxy = false) => {
    const finalUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(url)}` : url;
    
    // Convert file to ArrayBuffer for reliable binary transfer across CORS proxies
    const fileBuffer = await file.arrayBuffer();

    return await fetch(finalUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Type": file.type || "image/jpeg"
      },
      body: fileBuffer
    });
  };

  // Attempt 1: Direct Request
  try {
    recordApiLog("WP_UPLOAD_ATTEMPT", "PENDING", `Posting ${file.name} (${file.size} bytes) to ${targetUrl}`);
    const response = await doFetch(targetUrl, false);

    if (response.ok) {
      const data = await response.json();
      recordApiLog("WP_UPLOAD_SUCCESS", "201 OK", `Uploaded ID #${data.id} -> ${data.source_url}`);
      return {
        success: true,
        wpMediaId: data.id,
        url: data.source_url,
        filename: data.slug ? `${data.slug}.${file.name.split('.').pop()}` : file.name,
        link: data.link
      };
    }

    const errText = await response.text();
    recordApiLog("WP_UPLOAD_ERROR", `HTTP ${response.status}`, errText);
    return {
      success: false,
      status: response.status,
      error: `WP HTTP ${response.status}: ${errText.substring(0, 120)}`
    };

  } catch (directErr) {
    console.warn("Direct CORS fetch failed, attempting automatic CORS Proxy relay...", directErr);
    recordApiLog("WP_UPLOAD_CORS_WARN", "CORS_BLOCKED", `Direct fetch blocked: ${directErr.message}. Retrying via CORS Proxy...`);

    // Attempt 2: CORS Proxy Relay
    try {
      const response = await doFetch(targetUrl, true);

      if (response.ok) {
        const data = await response.json();
        recordApiLog("WP_UPLOAD_PROXY_SUCCESS", "201 OK via CORS Proxy", `Uploaded ID #${data.id} -> ${data.source_url}`);
        return {
          success: true,
          wpMediaId: data.id,
          url: data.source_url,
          filename: data.slug ? `${data.slug}.${file.name.split('.').pop()}` : file.name,
          link: data.link
        };
      }

      const errText = await response.text();
      recordApiLog("WP_UPLOAD_PROXY_ERROR", `HTTP ${response.status}`, errText);
      return {
        success: false,
        status: response.status,
        error: `WordPress returned HTTP ${response.status}: ${errText.substring(0, 120)}`
      };

    } catch (proxyErr) {
      console.error("CORS Proxy attempt failed:", proxyErr);
      recordApiLog("WP_UPLOAD_EXCEPTION", "NETWORK_ERROR", proxyErr.message);
      return {
        success: false,
        error: `Network Error: ${proxyErr.message}. Please check WordPress REST API CORS headers.`
      };
    }
  }
}

/**
 * Test WordPress REST API Connection & Credentials
 */
export async function testWordPressApiConnection(settings) {
  if (!settings || !settings.wpUsername || !settings.wpAppPassword) {
    return {
      success: false,
      message: "Please enter your WP Username and Application Password first in Settings."
    };
  }

  const domain = (settings.domain || "https://briantsofrisborough.co.uk").replace(/\/$/, "");
  const targetUrl = `${domain}/wp-json/wp/v2/users/me`;

  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);

  const testFetch = async (useProxy = false) => {
    const url = useProxy ? `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` : targetUrl;
    return await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": authHeader
      }
    });
  };

  try {
    const res = await testFetch(false);
    if (res.ok) {
      const user = await res.json();
      return {
        success: true,
        message: `✓ Direct Connection Success! Logged into WordPress as: ${user.name || user.slug} (ID: #${user.id})`
      };
    }

    const errBody = await res.text();
    return {
      success: false,
      status: res.status,
      message: `✗ WordPress rejected credentials (HTTP ${res.status}): ${errBody.substring(0, 120)}`
    };
  } catch (directErr) {
    // Retry with CORS Proxy
    try {
      const res = await testFetch(true);
      if (res.ok) {
        const user = await res.json();
        return {
          success: true,
          message: `✓ Connected via CORS Proxy Relay! Logged in as: ${user.name || user.slug} (ID: #${user.id})`
        };
      }
      const errBody = await res.text();
      return {
        success: false,
        status: res.status,
        message: `✗ WP via CORS Proxy HTTP ${res.status}: ${errBody.substring(0, 120)}`
      };
    } catch (proxyErr) {
      return {
        success: false,
        message: `✗ Direct & CORS Proxy blocked by browser/server policy: ${proxyErr.message}`
      };
    }
  }
}

/**
 * Update media Title and Alt Text directly in WordPress Media Library
 */
export async function updateWordPressMediaDetails(wpMediaId, details, settings) {
  if (!wpMediaId || !settings || !settings.wpUsername || !settings.wpAppPassword) {
    return null;
  }

  const domain = (settings.domain || "https://briantsofrisborough.co.uk").replace(/\/$/, "");
  const targetUrl = `${domain}/wp-json/wp/v2/media/${wpMediaId}`;

  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);

  const updateFetch = async (useProxy = false) => {
    const url = useProxy ? `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` : targetUrl;
    return await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: details.title,
        alt_text: details.title,
        caption: details.title
      })
    });
  };

  try {
    let response = await updateFetch(false);
    if (!response.ok) {
      response = await updateFetch(true);
    }

    if (!response.ok) {
      return { success: false, status: response.status };
    }

    const data = await response.json();
    return { success: true, wpMediaId: data.id };
  } catch (err) {
    console.error("Failed to update WordPress media metadata:", err);
    return { success: false, error: err.message };
  }
}
