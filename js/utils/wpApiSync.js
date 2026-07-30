/**
 * WordPress REST API Sync Utility
 * Uploads media files & updates media metadata directly in WordPress wp-json/wp/v2/media
 */

export async function uploadImageToWordPress(file, settings) {
  if (!settings || !settings.wpUsername || !settings.wpAppPassword) {
    return null; // Not configured
  }

  const domain = (settings.domain || "https://briantsofrisborough.co.uk").replace(/\/$/, "");
  const endpoint = `${domain}/wp-json/wp/v2/media`;

  const cleanAppPass = settings.wpAppPassword.replace(/\s+/g, "");
  const authHeader = "Basic " + btoa(`${settings.wpUsername}:${cleanAppPass}`);

  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("title", file.name.split(".")[0].replace(/[-_]/g, " "));

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": authHeader
      },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn("WordPress REST API upload returned error status:", response.status, errText);
      return { success: false, status: response.status, error: errText };
    }

    const data = await response.json();
    return {
      success: true,
      wpMediaId: data.id,
      url: data.source_url,
      filename: data.slug ? `${data.slug}.${file.name.split('.').pop()}` : file.name,
      link: data.link
    };
  } catch (err) {
    console.error("Failed to connect to WordPress REST API:", err);
    return { success: false, error: err.message };
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
