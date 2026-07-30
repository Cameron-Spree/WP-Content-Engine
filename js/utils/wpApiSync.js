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
  const endpoint = `${domain}/wp-json/wp/v2/media`;

  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);

  // Method 1: Try standard WP REST API raw binary upload with Content-Disposition
  try {
    recordApiLog("WP_UPLOAD_ATTEMPT", "PENDING", `Posting ${file.name} (${file.size} bytes) to ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Type": file.type || "image/jpeg"
      },
      body: file
    });

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

    // If Method 1 fails, parse error response
    const errText = await response.text();
    recordApiLog("WP_UPLOAD_ERROR", `HTTP ${response.status}`, errText);

    // Fallback Method 2: Try FormData upload
    const formData = new FormData();
    formData.append("file", file, file.name);

    const res2 = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": authHeader
      },
      body: formData
    });

    if (res2.ok) {
      const data2 = await res2.json();
      recordApiLog("WP_UPLOAD_SUCCESS_FORM", "201 OK", `Uploaded ID #${data2.id} -> ${data2.source_url}`);
      return {
        success: true,
        wpMediaId: data2.id,
        url: data2.source_url,
        filename: data2.slug ? `${data2.slug}.${file.name.split('.').pop()}` : file.name,
        link: data2.link
      };
    }

    const errText2 = await res2.text();
    recordApiLog("WP_UPLOAD_FORM_ERROR", `HTTP ${res2.status}`, errText2);

    return {
      success: false,
      status: response.status,
      error: `WP HTTP ${response.status}: ${errText.substring(0, 120)}`
    };

  } catch (err) {
    console.error("Failed to connect to WordPress REST API:", err);
    recordApiLog("WP_UPLOAD_EXCEPTION", "NETWORK_ERROR / CORS", err.message);
    return {
      success: false,
      error: `Network / CORS Error: ${err.message}. Check if your site allows cross-origin requests.`
    };
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
  const testEndpoint = `${domain}/wp-json/wp/v2/users/me`;

  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);

  try {
    const res = await fetch(testEndpoint, {
      method: "GET",
      headers: {
        "Authorization": authHeader
      }
    });

    if (res.ok) {
      const user = await res.json();
      return {
        success: true,
        message: `✓ Connected successfully to WordPress! Logged in as: ${user.name || user.slug} (ID: #${user.id})`
      };
    }

    const errBody = await res.text();
    return {
      success: false,
      status: res.status,
      message: `✗ WordPress API rejected credentials (HTTP ${res.status}): ${errBody.substring(0, 150)}`
    };
  } catch (err) {
    return {
      success: false,
      message: `✗ Network/CORS Error reaching ${testEndpoint}: ${err.message}`
    };
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
  const endpoint = `${domain}/wp-json/wp/v2/media/${wpMediaId}`;

  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);

  try {
    const response = await fetch(endpoint, {
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
