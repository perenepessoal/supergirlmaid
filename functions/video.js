export async function onRequest(context) {
  const url = new URL(context.request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return new Response("Missing video URL", { status: 400 });
  }

  const resp = await fetch(target, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!resp.ok) {
    return new Response("Failed to fetch video", { status: resp.status });
  }

  return new Response(resp.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400"
    }
  });
}