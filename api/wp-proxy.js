/**
 * Vercel Serverless Function Proxy for WordPress REST API & Image Previews
 * Relays media uploads, live keyword searches, and image thumbnail previews server-to-server to bypass hotlink & CORS blocks.
 */

export const config = {
  api: {
    bodyParser: false, // Disable Vercel body parsing to allow raw binary image streaming
  },
};

export default async function handler(req, res) {
  // Set CORS & Cache headers for our own app
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Content-Disposition, X-WP-Domain, X-WP-Action, X-WP-Media-Id, X-WP-Query, X-WP-Img-Url");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Action: Image Proxy Relay (Bypasses Nexcess hotlink protection & CORS image blocks)
  const action = req.headers["x-wp-action"] || req.query.action || "upload";
  const proxyImgUrl = req.query.imgUrl || req.headers["x-wp-img-url"];

  if (action === "image" || proxyImgUrl) {
    const targetUrl = proxyImgUrl || req.query.url;
    if (!targetUrl) return res.status(400).send("Missing imgUrl");

    try {
      const imgResponse = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!imgResponse.ok) {
        return res.status(imgResponse.status).send(`Failed to fetch image: ${imgResponse.statusText}`);
      }

      const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

      const arrayBuffer = await imgResponse.arrayBuffer();
      return res.status(200).send(Buffer.from(arrayBuffer));
    } catch (err) {
      console.error("Image Proxy Relay error:", err);
      return res.status(500).send(`Image proxy error: ${err.message}`);
    }
  }

  const wpDomain = (req.headers["x-wp-domain"] || "https://briantsofrisborough.co.uk").replace(/\/$/, "");
  const authHeader = req.headers["authorization"];
  const searchQuery = req.headers["x-wp-query"] || "";

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

    if (action === "list" || action === "search") {
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
      const targetUrl = `${wpDomain}/wp-json/wp/v2/media?per_page=50${searchParam}`;
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

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const binaryBuffer = Buffer.concat(chunks);

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
