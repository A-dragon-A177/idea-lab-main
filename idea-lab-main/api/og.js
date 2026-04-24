/**
 * Vercel Serverless Function: OG Tag Generator for Shared Blog Links
 *
 * When a social media bot (WhatsApp, Facebook, Twitter, LinkedIn, etc.) crawls
 * a shared blog link (/p/slug-uuid), this function fetches the blog's metadata
 * from the backend and returns a minimal HTML page with proper OG meta tags.
 *
 * Regular browser users are never routed here — only bots (via vercel.json
 * conditional rewrite on User-Agent header).
 *
 * OG Tags returned:
 *   - og:title       → Project title (from project data)
 *   - og:description → Project one-line summary (NOT blog body content)
 *   - og:image       → Blog cover image URL
 */

export default async function handler(req, res) {
  const slug = req.query.slug || '';
  const host = req.headers.host || 'www.neeshglobal.com';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Parse UUID from the slug (format: "my-blog-title-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")
  const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
  const uuidMatch = slug.match(uuidRegex);

  // Default OG values (fallback)
  let title = 'Neesh AI Blog';
  let description = 'AI-powered content and niche project validation platform';
  let image = `${baseUrl}/favicon.png`;
  const url = `${baseUrl}/p/${slug}`;

  if (uuidMatch) {
    const projectId = uuidMatch[1];
    const backendUrl = process.env.VITE_BACKEND_URL || 'https://neesh-ai.onrender.com';

    // Fetch both project data (for title + one-liner) and blog data (for cover image)
    // in parallel for speed
    try {
      const [projectRes, blogRes] = await Promise.all([
        fetch(`${backendUrl}/api/public/projects/${projectId}`).catch(() => null),
        fetch(`${backendUrl}/api/public/projects/${projectId}/blog`).catch(() => null),
      ]);

      // Extract project data: title + oneLineSummary
      if (projectRes && projectRes.ok) {
        const projectData = await projectRes.json();

        if (projectData.title) {
          title = projectData.title;
        }

        // Use oneLineSummary as the OG description (the user's short project tagline)
        if (projectData.oneLineSummary) {
          description = projectData.oneLineSummary;
        }
      }

      // Extract blog data: cover image
      if (blogRes && blogRes.ok) {
        const blogData = await blogRes.json();

        // Use blog heading as title if project title wasn't available
        if (title === 'Neesh AI Blog' && blogData.heading) {
          title = blogData.heading;
        }

        // Cover image for the OG preview
        if (blogData.coverImageUrl && blogData.coverImageUrl.length > 10) {
          image = blogData.coverImageUrl;
        }
      }
    } catch (err) {
      console.error('[OG] Failed to fetch data:', err.message);
      // Continue with defaults — don't crash the response
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} | Neesh AI</title>
  <meta name="description" content="${esc(description)}">

  <!-- Open Graph Protocol -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:site_name" content="Neesh AI">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">

  <link rel="icon" type="image/png" href="/favicon.png">
</head>
<body>
  <h1>${esc(title)}</h1>
  <p>${esc(description)}</p>
  <p><a href="${esc(url)}">Read on Neesh AI</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache for 5 minutes, serve stale for 10 while revalidating
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(html);
}

/** Escape HTML special characters to prevent injection */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
