/**
 * WordPress REST API Sync Utility
 * Relays uploads & metadata via Vercel Serverless Function Proxy (/api/wp-proxy)
 * Zero WordPress side changes, 100% safe, handles large files (8MB+) with no CORS issues.
 */

import { recordApiLog } from "./debugLogger.js";

function getProxyEndpoint() {
  // Use relative path /api/wp-proxy on Vercel deployment
  return "/api/wp-proxy";
}

export async function uploadImageToWordPress(file, settings) {
  if (!settings || !settings.wpUsername || !settings.wpAppPassword) {
    recordApiLog("WP_UPLOAD", "FAILED", "Missing username or application password");
    return { success: false, error: "Missing WordPress credentials in Settings" };
  }

  const wpDomain = (settings.domain || "https://briantsofrisborough.co.uk").replace(/\/$/, "");
  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);
  const proxyUrl = getProxyEndpoint();

  try {
    recordApiLog("WP_UPLOAD_ATTEMPT", "PENDING", `Relaying ${file.name} (${file.size} bytes) via Vercel Proxy to ${wpDomain}`);
    
    const fileBuffer = await file.arrayBuffer();

    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Type": file.type || "image/jpeg",
        "X-WP-Domain": wpDomain,
        "X-WP-Action": "upload"
      },
      body: fileBuffer
    });

    if (response.ok) {
      const data = await response.json();
      recordApiLog("WP_UPLOAD_SUCCESS", "201 OK", `Uploaded to WP Media Library ID #${data.id} -> ${data.source_url}`);
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
      error: `WordPress returned HTTP ${response.status}: ${errText.substring(0, 150)}`
    };

  } catch (err) {
    console.error("Serverless Relay upload error:", err);
    recordApiLog("WP_UPLOAD_EXCEPTION", "NETWORK_ERROR", err.message);
    return {
      success: false,
      error: `Relay Error: ${err.message}`
    };
  }
}

/**
 * Test WordPress REST API Connection via Vercel Serverless Proxy
 */
export async function testWordPressApiConnection(settings) {
  if (!settings || !settings.wpUsername || !settings.wpAppPassword) {
    return {
      success: false,
      message: "Please enter your WP Username and Application Password first in Settings."
    };
  }

  const wpDomain = (settings.domain || "https://briantsofrisborough.co.uk").replace(/\/$/, "");
  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);
  const proxyUrl = getProxyEndpoint();

  try {
    const res = await fetch(proxyUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "X-WP-Domain": wpDomain,
        "X-WP-Action": "test"
      }
    });

    if (res.ok) {
      const user = await res.json();
      return {
        success: true,
        message: `✓ Connected to WordPress via Vercel Serverless Proxy! Logged in as: ${user.name || user.slug} (ID: #${user.id})`
      };
    }

    const errBody = await res.text();
    return {
      success: false,
      status: res.status,
      message: `✗ WordPress API returned HTTP ${res.status}: ${errBody.substring(0, 150)}`
    };
  } catch (err) {
    return {
      success: false,
      message: `✗ Proxy Connection Error: ${err.message}`
    };
  }
}

/**
 * Update media Title and Alt Text directly in WordPress Media Library via Serverless Relay
 */
export async function updateWordPressMediaDetails(wpMediaId, details, settings) {
  if (!wpMediaId || !settings || !settings.wpUsername || !settings.wpAppPassword) {
    return null;
  }

  const wpDomain = (settings.domain || "https://briantsofrisborough.co.uk").replace(/\/$/, "");
  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);
  const proxyUrl = getProxyEndpoint();

  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
        "X-WP-Domain": wpDomain,
        "X-WP-Action": "update",
        "X-WP-Media-Id": String(wpMediaId)
      },
      body: JSON.stringify({
        title: details.title,
        alt_text: details.title,
        caption: details.title
      })
    });

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
