export async function onRequest(context) {
  const url = new URL(context.request.url);
  const target = url.searchParams.get("url");

  // 1. Validação básica do parâmetro
  if (!target) {
    return new Response("Falta o parâmetro URL do vídeo.", { status: 400 });
  }

  // 2. Segurança: Só aceita requisições para os servidores de mídia oficiais do Twitter/X
  if (!target.startsWith("https://video.twimg.com") && !target.startsWith("https://pbs.twimg.com")) {
    return new Response("URL de destino não permitida.", { status: 403 });
  }

  try {
    const requestHeaders = new Headers();
    requestHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    requestHeaders.set("Accept", "*/*");
    requestHeaders.set("Accept-Language", "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7");
    requestHeaders.set("Referer", "https://x.com/");
    requestHeaders.set("Origin", "https://x.com");

    // 3. CRUCIAL: Repassar o cabeçalho 'Range' enviado pelo navegador. 
    // Sem isso, o player do navegador não consegue avançar ou voltar o vídeo (seek).
    const rangeHeader = context.request.headers.get("range");
    if (rangeHeader) {
      requestHeaders.set("range", rangeHeader);
    }

    // Executa a busca no Twitter
    const resp = await fetch(target, {
      method: "GET",
      headers: requestHeaders,
      redirect: "follow"
    });

    // 4. Se o Twitter responder com 403 aqui, o bloqueio é definitivo pelo IP do datacenter
    if (resp.status === 403) {
      return new Response("O Twitter barrou esta requisição (403 Forbidden no IP da Cloudflare).", { 
        status: 403,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // 5. Monta a resposta limpando e injetando os cabeçalhos de mídia corretos
    const responseHeaders = new Headers(resp.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Cache-Control", "public, max-age=86400");
    
    if (!responseHeaders.has("Content-Type")) {
      responseHeaders.set("Content-Type", "video/mp4");
    }

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders
    });

  } catch (err) {
    return new Response("Erro interno no Proxy: " + err.message, { status: 500 });
  }
}