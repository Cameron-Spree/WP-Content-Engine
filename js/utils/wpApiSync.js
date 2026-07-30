/**
 * WordPress REST API Sync Utility
 * Uploads media files directly to WordPress wp-json/wp/v2/media
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
