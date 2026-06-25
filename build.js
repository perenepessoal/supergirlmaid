const fs = require("fs");
const path = require("path");
const fse = require("fs-extra");

const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const PAGE_DIR = path.join(PUBLIC_DIR, "page");

const PAGE_SIZE = 50;

/* ================= UTIL ================= */

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanYtdFile(content) {
  return content
    .replace(/^window\.YTD\.tweets\.part\d+\s*=\s*/m, "")
    .replace(/;\s*$/, "");
}

/* ================= LOAD ================= */

function loadAllTweets() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f === "tweets.js" || /^tweets-part\d+\.js$/i.test(f))
    .sort((a, b) => {
      if (a === "tweets.js") return -1;
      if (b === "tweets.js") return 1;

      const na = parseInt(a.match(/\d+/)?.[0] || "0", 10);
      const nb = parseInt(b.match(/\d+/)?.[0] || "0", 10);
      return na - nb;
    });

  let allTweets = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
    const jsonText = cleanYtdFile(raw);
    const part = JSON.parse(jsonText);

    for (const item of part) {
      if (item?.tweet) allTweets.push(item.tweet);
    }
  }

  return allTweets;
}

/* ================= FILTER ================= */

function isOriginalTweet(tweet) {
  return (
    !tweet.retweeted &&
    !tweet.in_reply_to_status_id &&
    !tweet.in_reply_to_user_id &&
    !tweet.quoted_status_id
  );
}

/* ================= MEDIA ================= */

function getBestVideo(media) {
  if (!media.video_info) return null;

  const mp4s = media.video_info.variants
    .filter((v) => v.content_type === "video/mp4" && v.url)
    .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));

  return mp4s.length ? mp4s[0].url : null;
}

function renderMedia(tweet) {
  const media = tweet.extended_entities?.media || [];
  if (!media.length) return "";

  let html = `<div class="media-grid">`;

  for (const m of media) {
    if (m.type === "photo") {
      html += `
        <div class="media-item">
          <img loading="lazy" src="${m.media_url_https}" alt="">
        </div>
      `;
    }

    if (m.type === "video" || m.type === "animated_gif") {
      const videoUrl = getBestVideo(m);

      if (videoUrl) {
        html += `
          <div class="media-item">
            <video controls preload="metadata" poster="${m.media_url_https || ""}">
              <source src="${videoUrl}">
            </video>
          </div>
        `;
      }
    }
  }

  html += `</div>`;
  return html;
}

/* ================= TWEET ================= */

function renderTweet(tweet) {
  const text = escapeHtml(tweet.full_text || "");
  const id = tweet.id_str || tweet.id || "";
  const url = "https://x.com/i/web/status/" + id;

  return `
    <article class="tweet">
      <div class="tweet-meta" data-date="${tweet.created_at || ""}"></div>

      <div class="tweet-text">
        ${text.replace(/\n/g, "<br>")}
      </div>

      ${renderMedia(tweet)}

      <div class="tweet-link">
        <a href="${url}" target="_blank" data-t="open">Abrir tweet original</a>
      </div>
    </article>
  `;
}

/* ================= PAGINATION ================= */

function buildPagination(pageNum, totalPages) {
  const current = pageNum;
  const last = totalPages;
  const delta = 2;

  const left = current - delta;
  const right = current + delta + 1;

  const range = [];
  const pages = [];
  let l;

  for (let i = 1; i <= last; i++) {
    if (i === 1 || i === last || (i >= left && i < right)) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) pages.push(l + 1);
      else if (i - l > 2) pages.push("dots");
    }
    pages.push(i);
    l = i;
  }

  let html = `<div class="pagination">`;

  if (pageNum > 1) {
    html += `<a href="${pageNum - 1}.html" data-t="prev">← Anterior</a> - `;
  }

  pages.forEach((p, idx) => {
    const lastItem = idx === pages.length - 1;

    if (p === "dots") {
      html += `<span class="dots" onclick="openJump()">...</span>`;
    } else if (p === pageNum) {
      html += `<strong>${p}</strong>`;
    } else {
      html += `<a href="${p}.html">${p}</a>`;
    }

    if (!lastItem) html += " - ";
  });

  if (pageNum < totalPages) {
    html += ` - <a href="${pageNum + 1}.html" data-t="next">Próxima →</a>`;
  }

  html += `</div>`;
  return html;
}

/* ================= TRANSLATIONS ================= */

function getTranslations(subtitle) {
  return {
    pt: {
      prev: "← Anterior",
      next: "Próxima →",
      open: "Abrir tweet original",
      jumpTitle: "Ir para página",
      jumpClose: "Fechar",
      subtitle
    },

    en: {
      prev: "← Previous",
      next: "Next →",
      open: "Open original tweet",
      jumpTitle: "Go to page",
      jumpClose: "Close",
      subtitle:
        "A page dedicated to the best heroes in the Universe! The full archive of more than 60,000 posts from my X account, related to Artificial Intelligence content, is available below:"
    },

    es: {
      prev: "← Anterior",
      next: "Siguiente →",
      open: "Ver tweet original",
      jumpTitle: "Ir a la página",
      jumpClose: "Cerrar",
      subtitle:
        "¡Una página dedicada a los mejores héroes del Universo! El archivo completo de más de 60.000 publicaciones de mi cuenta de X, relacionado con contenido de IA, está disponible a continuación:"
    },

    ru: {
      prev: "← Предыдущая",
      next: "Следующая →",
      open: "Открыть твит",
      jumpTitle: "Перейти к странице",
      jumpClose: "Закрыть",
      subtitle:
        "Страница, посвящённая лучшим героям Вселенной! Полный архив более 60 000 публикаций из моего аккаунта X, связанных с ИИ, доступен ниже:"
    },

    tr: {
      prev: "← Önceki",
      next: "Sonraki →",
      open: "Tweeti aç",
      jumpTitle: "Sayfaya git",
      jumpClose: "Kapat",
      subtitle:
        "Evrenin en iyi kahramanlarına adanmış sayfa! Yapay zeka içeriğiyle ilgili X hesabımdaki 60 binden fazla gönderinin arşivi aşağıdadır:"
    },

    zh: {
      prev: "← 上一页",
      next: "下一页 →",
      open: "打开推文",
      jumpTitle: "跳转页面",
      jumpClose: "关闭",
      subtitle:
        "献给宇宙中最伟大英雄的页面！我X账号中超过6万条与人工智能相关的帖子完整存档如下："
    },

    ar: {
      prev: "← السابق",
      next: "التالي →",
      open: "فتح التغريدة",
      jumpTitle: "اذهب إلى الصفحة",
      jumpClose: "إغلاق",
      subtitle:
        "صفحة مخصصة لأعظم أبطال الكون! أرشيف أكثر من 60 ألف منشور من حسابي على X حول الذكاء الاصطناعي متاح أدناه:"
    }
  };
}

/* ================= PAGE ================= */

function renderPage(tweets, pageNum, totalPages) {
  const tweetsHtml = tweets.map(renderTweet).join("\n");

  const subtitle =
    "Página dedicada aos melhores heróis do Universo! Todo o acervo de mais de 60 mil publicações da minha conta do \"X\", relacionado a conteúdo de Inteligência Artificial, está disponível abaixo:";

  const translations = getTranslations(subtitle);

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Supergirl(MAID) - ${pageNum}</title>

<style>
*{box-sizing:border-box}

body{
  font-family: Arial, sans-serif;
  background:#eee;
  margin:0 auto;
  max-width:1400px;
  padding:15px;
  overflow-x:hidden;
}

.site-title{
  font-size:32px;
  font-weight:bold;
  margin:10px 0 5px 0;
}

.site-subtitle{
  font-size:15px;
  font-weight:normal;
  color:#444;
  margin:0 0 20px 0;
  line-height:1.5;
  max-width:1100px;
}

.tweets-container{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:12px;
}

@media(max-width:900px){
  .tweets-container{grid-template-columns:1fr;}
}

.tweet{
  background:#fff;
  border:1px solid #ccc;
  padding:10px;
  border-radius:6px;
}

.tweet-text{
  font-size:14px;
  line-height:1.4;
  word-break:break-word;
  overflow-wrap:break-word;
}

.media-grid{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:10px;
}

img,video{
  max-width:100%;
  display:block;
  border-radius:6px;
}

.pagination{
  margin:15px 0;
  font-size:14px;
}

.pagination a{
  text-decoration:none;
  color:#0645ad;
}

.pagination strong{color:#000;}

.dots{cursor:pointer;color:#444;font-weight:bold;}

#jumpModal{
  display:none;
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.6);
  justify-content:center;
  align-items:center;
  z-index:9999;
}

#jumpBox{
  background:#fff;
  padding:20px;
  border-radius:8px;
  text-align:center;
}
</style>

<script>
function openJump(){document.getElementById("jumpModal").style.display="flex";}
function closeJump(){document.getElementById("jumpModal").style.display="none";}

var totalPagesGlobal=${totalPages};
var pageNumGlobal=${pageNum};

function goPage(){
  const p=parseInt(document.getElementById("pageInput").value,10);
  if(!p||p<1||p>totalPagesGlobal)return;
  if(p===pageNumGlobal)return;
  window.location.href=p+".html";
}
</script>

</head>

<body>

<div class="site-title">Supergirl(MAID)</div>
<p class="site-subtitle" id="subtitle"></p>

${buildPagination(pageNum, totalPages)}

<div class="tweets-container">
${tweetsHtml}
</div>

${buildPagination(pageNum, totalPages)}

<div id="jumpModal">
  <div id="jumpBox">
    <p data-t="jumpTitle">Go to page</p>
    <input id="pageInput" type="number" min="1" max="${totalPages}" onkeydown="if(event.key === 'Enter') goPage()">
    <button onclick="goPage()">OK</button>
    <button onclick="closeJump()" data-t="jumpClose">Close</button>
  </div>
</div>

<script>
(function(){
  const locale=navigator.language||"pt-BR";
  const lang=locale.split("-")[0];

  const translations=${JSON.stringify(translations)};

  const t=translations[lang]||translations.en;

  document.getElementById("subtitle").textContent=t.subtitle;

  document.querySelectorAll("[data-t]").forEach(el=>{
    const key=el.getAttribute("data-t");
    if(t[key]) el.textContent=t[key];
  });

  document.querySelectorAll(".tweet-meta").forEach(el=>{
    const raw=el.getAttribute("data-date");
    if(!raw)return;
    const d=new Date(raw);
    if(isNaN(d)){el.textContent=raw;return;}

    el.textContent=new Intl.DateTimeFormat(locale,{
      weekday:"short",
      year:"numeric",
      month:"short",
      day:"2-digit",
      hour:"2-digit",
      minute:"2-digit",
      second:"2-digit"
    }).format(d);
  });

  if(lang==="ar"){
    document.body.style.direction="rtl";
  }
})();
</script>

</body>
</html>
`;
}

/* ================= MAIN ================= */

async function main() {
  let tweets = loadAllTweets();
  tweets = tweets.filter(isOriginalTweet);
  tweets.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  await fse.remove(PUBLIC_DIR);
  await fse.ensureDir(PAGE_DIR);

  const totalPages = Math.ceil(tweets.length / PAGE_SIZE);

  for (let i = 0; i < totalPages; i++) {
    const pageTweets = tweets.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
    const html = renderPage(pageTweets, i + 1, totalPages);

    fs.writeFileSync(path.join(PAGE_DIR, `${i + 1}.html`), html, "utf8");
  }

  console.log("OK:", totalPages);
}

main().catch(console.error);