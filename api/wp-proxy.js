/**
 * Vercel Serverless Function Proxy for WordPress REST API
 * Relays media uploads & API calls server-to-server to avoid browser CORS restrictions.
 */

export const config = {
  api: {
    bodyParser: false, // Disable Vercel body parsing to allow raw binary image streaming
  },
};

export default async function handler(req, res) {
  // Set CORS headers for our own app
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Content-Disposition, X-WP-Domain, X-WP-Action");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const wpDomain = (req.headers["x-wp-domain"] || "https://briantsofrisborough.co.uk").replace(/\/$/, "");
  const authHeader = req.headers["authorization"];
  const action = req.headers["x-wp-action"] || "upload";

  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  try {
    if (action === "test") {
      const targetUrl = `${wpDomain}/wp-json/wp/v2/users/me`;
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: { "Authorization": authHeader }
      });
      const data = await response.text();
      return res.status(response.status).send(data);
    }

    if (action === "update") {
      const wpMediaId = req.headers["x-wp-media-id"];
      const targetUrl = `${wpDomain}/wp-json/wp/v2/media/${wpMediaId}`;
      
      // Collect JSON body
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const bodyBuffer = Buffer.concat(chunks);

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: bodyBuffer
      });
      const data = await response.text();
      return res.status(response.status).send(data);
    }

    // Default: Media Upload
    const targetUrl = `${wpDomain}/wp-json/wp/v2/media`;
    const contentDisp = req.headers["content-disposition"] || "attachment; filename=\"upload.jpg\"";
    const contentType = req.headers["content-type"] || "image/jpeg";

    // Read full incoming binary request body from browser
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const binaryBuffer = Buffer.concat(chunks);

    // Forward server-to-server to WordPress REST API
    const wpResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Disposition": contentDisp,
        "Content-Type": contentType
      },
      body: binaryBuffer
    });

    const responseText = await wpResponse.text();
    return res.status(wpResponse.status).send(responseText);

  } catch (err) {
    console.error("Vercel Serverless Relay Error:", err);
    return res.status(500).json({ error: `Serverless Proxy Failure: ${err.message}` });
  }
}
