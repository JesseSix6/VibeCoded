// Tracker — Cloudflare Worker
// Houdt de GitHub token veilig server-side.
// Deploy via: https://dash.cloudflare.com/workers

const ALLOWED_ORIGIN = "https://jessesix6.github.io"; // jouw GitHub Pages URL

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // /read?gist_id=...&file=...
    if (request.method === "GET" && url.pathname === "/read") {
      const gistId = url.searchParams.get("gist_id");
      const file   = url.searchParams.get("file");

      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Tracker-Worker",
        }
      });

      if (!res.ok) return new Response("GitHub error", { status: res.status, headers: cors(origin) });

      const gist    = await res.json();
      const content = gist.files[file]?.content || "[]";

      return new Response(content, {
        headers: { ...cors(origin), "Content-Type": "application/json" }
      });
    }

    // /write  body: { gist_id, file, data }
    if (request.method === "POST" && url.pathname === "/write") {
      const { gist_id, file, data } = await request.json();

      const res = await fetch(`https://api.github.com/gists/${gist_id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "Tracker-Worker",
        },
        body: JSON.stringify({ files: { [file]: { content: JSON.stringify(data) } } })
      });

      if (!res.ok) return new Response("GitHub error", { status: res.status, headers: cors(origin) });

      return new Response("ok", { headers: cors(origin) });
    }

    return new Response("Not found", { status: 404, headers: cors(origin) });
  }
};
