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
  <source src="/video?url=${encodeURIComponent(videoUrl)}" type="video/mp4">
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
        "A page dedicated to the best heroes in the Universe! The full archive of 63,023 posts from my X account, related to Artificial Intelligence content, is available below:"
    },

    es: {
      prev: "← Anterior",
      next: "Siguiente →",
      open: "Ver tweet original",
      jumpTitle: "Ir a página",
      jumpClose: "Cerrar",
      subtitle:
        "¡Una página dedicada a los mejores héroes del Universo! El archivo completo de 63.023 publicaciones de mi cuenta de X, relacionado con contenido de IA, está disponible a continuación:"
    },

    ru: {
      prev: "← Предыдущая",
      next: "Следующая →",
      open: "Открыть твит",
      jumpTitle: "Перейти к странице",
      jumpClose: "Закрыть",
      subtitle:
        "Страница, посвящённая лучшим героям Вселенной! Полный архив более 63 000 публикаций из моего аккаунта X, связанных с ИИ, доступен ниже:"
    },

    tr: {
      prev: "← Önceki",
      next: "Sonraki →",
      open: "Tweeti aç",
      jumpTitle: "Sayfaya git",
      jumpClose: "Kapat",
      subtitle:
        "Evrenin en iyi kahramanlarına adanmış sayfa! Yapay zeka içeriğiyle ilgili X hesabımdaki 63 binden fazla gönderinin arşivi aşağıdadır:"
    },

    zh: {
      prev: "← 上一页",
      next: "下一页 →",
      open: "打开推文",
      jumpTitle: "跳转页面",
      jumpClose: "关闭",
      subtitle:
        "献给宇宙中最伟大英雄的页面！我X账号中超过6.3万条与人工智能相关的帖子完整存档如下:"
    },

    ar: {
      prev: "← السابق",
      next: "التالي →",
      open: "فتح التغريدة",
      jumpTitle: "اذهب إلى الصفحة",
      jumpClose: "إغلاق",
      subtitle:
        "صفحة مخصصة لأعظم أبطال الكون! أرشيف أكثر من 63 ألف منشور من حسابي على X حول الذكاء الاصطناعي متاح أدناه:"
    },

    hi: {
      prev: "← पिछला",
      next: "अगला →",
      open: "मूल ट्वीट खोलें",
      jumpTitle: "पृष्ठ पर जाएँ",
      jumpClose: "बंद करें",
      subtitle:
        "ब्रह्मांड के सर्वश्रेष्ठ नायकों को समर्पित एक पृष्ठ! मेरे X खाते से कृत्रिम बुद्धिमत्ता से संबंधित 63 हज़ार से अधिक पोस्ट का पूरा संग्रह नीचे उपलब्ध है:"
    },

    bn: {
      prev: "← পূর্ববর্তী",
      next: "পরবর্তী →",
      open: "মূল পোস্ট খুলুন",
      jumpTitle: "পৃষ্ঠায় যান",
      jumpClose: "বন্ধ করুন",
      subtitle:
        "মহাবিশ্বের সেরা নায়কদের জন্য নিবেদিত একটি পৃষ্ঠা! আমার X অ্যাকাউন্টের কৃত্রিম বুদ্ধিমত্তা সম্পর্কিত ৬৩ হাজারেরও বেশি পোস্টের সম্পূর্ণ সংরক্ষণাগার নিচে রয়েছে:"
    },

    ja: {
      prev: "← 前へ",
      next: "次へ →",
      open: "元のポストを開く",
      jumpTitle: "ページへ移動",
      jumpClose: "閉じる",
      subtitle:
        "宇宙で最高のヒーローたちに捧げるページです！私のXアカウントにある人工知能関連の6万3千件以上の投稿を完全にアーカイブしています。以下からご覧いただけます："
    },

    lah: {
      prev: "← پچھلا",
      next: "اگلا →",
      open: "اصل ٹویٹ کھولو",
      jumpTitle: "صفحے تے جاؤ",
      jumpClose: "بند کرو",
      subtitle:
        "کائنات دے بہترین ہیروز لئی وقف صفحہ! میرے X اکاؤنٹ دیاں مصنوعی ذہانت نال متعلق 63 ہزار توں ودھ پوسٹاں دا مکمل آرکائیو ہیٹھاں موجود اے:"
    },

    jv: {
      prev: "← Sadurunge",
      next: "Sabanjuré →",
      open: "Bukak kiriman asli",
      jumpTitle: "Menyang kaca",
      jumpClose: "Tutup",
      subtitle:
        "Kaca sing dikhususake kanggo para pahlawan paling apik ing Alam Semesta! Arsip lengkap luwih saka 63 ewu kiriman saka akun X-ku sing gegayutan karo konten Kecerdasan Buatan kasedhiya ing ngisor iki:"
    },

    ko: {
      prev: "← 이전",
      next: "다음 →",
      open: "원본 게시물 열기",
      jumpTitle: "페이지로 이동",
      jumpClose: "닫기",
      subtitle:
        "우주 최고의 영웅들을 위한 페이지입니다! 제 X 계정에 있는 인공지능 관련 게시물 6만 3천 개 이상의 전체 아카이브를 아래에서 확인할 수 있습니다:"
    },

    de: {
      prev: "← Zurück",
      next: "Weiter →",
      open: "Originalen Beitrag öffnen",
      jumpTitle: "Zu Seite gehen",
      jumpClose: "Schließen",
      subtitle:
        "Eine Seite, die den besten Helden des Universums gewidmet ist! Das vollständige Archiv von mehr als 63.000 Beiträgen aus meinem X-Konto zum Thema Künstliche Intelligenz ist unten verfügbar:"
    },

    fr: {
      prev: "← Précédent",
      next: "Suivant →",
      open: "Ouvrir le post original",
      jumpTitle: "Aller à la page",
      jumpClose: "Fermer",
      subtitle:
        "Une page dédiée aux meilleurs héros de l’Univers ! L’archive complète de plus de 63 000 publications de mon compte X liées au contenu sur l’intelligence artificielle est disponible ci-dessous :"
    },

    te: {
      prev: "← మునుపటి",
      next: "తదుపరి →",
      open: "అసలు పోస్ట్‌ను తెరవండి",
      jumpTitle: "పేజీకి వెళ్లండి",
      jumpClose: "మూసివేయండి",
      subtitle:
        "విశ్వంలోని అత్యుత్తమ హీరోలకు అంకితమైన పేజీ! నా X ఖాతాలో కృత్రిమ మేధస్సుకు సంబంధించిన 63 వేల కంటే ఎక్కువ పోస్ట్‌ల పూర్తి ఆర్కైవ్ క్రింద అందుబాటులో ఉంది:"
    },

    mr: {
      prev: "← मागील",
      next: "पुढील →",
      open: "मूळ पोस्ट उघडा",
      jumpTitle: "पृष्ठावर जा",
      jumpClose: "बंद करा",
      subtitle:
        "विश्वातील सर्वोत्तम नायकांना समर्पित पृष्ठ! माझ्या X खात्यावरील कृत्रिम बुद्धिमत्तेशी संबंधित 63 हजारांहून अधिक पोस्टचे संपूर्ण संग्रहण खाली उपलब्ध आहे:"
    },

    ur: {
      prev: "← پچھلا",
      next: "اگلا →",
      open: "اصل پوسٹ کھولیں",
      jumpTitle: "صفحے پر جائیں",
      jumpClose: "بند کریں",
      subtitle:
        "کائنات کے بہترین ہیروز کے لیے وقف ایک صفحہ! میرے X اکاؤنٹ پر مصنوعی ذہانت سے متعلق 63 ہزار سے زیادہ پوسٹس کا مکمل آرکائیو ذیل میں دستیاب ہے:"
    },

    vi: {
      prev: "← Trước",
      next: "Tiếp →",
      open: "Mở bài đăng gốc",
      jumpTitle: "Đi đến trang",
      jumpClose: "Đóng",
      subtitle:
        "Một trang dành riêng cho những anh hùng tuyệt vời nhất trong Vũ trụ! Kho lưu trữ đầy đủ hơn 63 nghìn bài đăng từ tài khoản X của tôi liên quan đến nội dung Trí tuệ Nhân tạo có sẵn bên dưới:"
    },

    ta: {
      prev: "← முந்தையது",
      next: "அடுத்தது →",
      open: "அசல் பதிவைத் திறக்கவும்",
      jumpTitle: "பக்கத்திற்குச் செல்லவும்",
      jumpClose: "மூடவும்",
      subtitle:
        "பிரபஞ்சத்தின் சிறந்த ஹீரோக்களுக்காக அர்ப்பணிக்கப்பட்ட பக்கம்! எனது X கணக்கில் செயற்கை நுண்ணறிவு தொடர்பான 63 ஆயிரத்துக்கும் மேற்பட்ட பதிவுகளின் முழுமையான காப்பகம் கீழே கிடைக்கிறது:"
    },

    it: {
      prev: "← Precedente",
      next: "Successivo →",
      open: "Apri il post originale",
      jumpTitle: "Vai alla pagina",
      jumpClose: "Chiudi",
      subtitle:
        "Una pagina dedicata ai migliori eroi dell'Universo! L'archivio completo di oltre 63 mila post dal mio account X relativi ai contenuti sull'Intelligenza Artificiale è disponibile qui sotto:"
    },

    pl: {
      prev: "← Poprzednia",
      next: "Następna →",
      open: "Otwórz oryginalny post",
      jumpTitle: "Przejdź do strony",
      jumpClose: "Zamknij",
      subtitle:
        "Strona poświęcona najlepszym bohaterom Wszechświata! Pełne archiwum ponad 63 tysięcy postów z mojego konta X związanych z treściami dotyczącymi sztucznej inteligencji jest dostępne poniżej:"
    },

    nl: {
      prev: "← Vorige",
      next: "Volgende →",
      open: "Origineel bericht openen",
      jumpTitle: "Ga naar pagina",
      jumpClose: "Sluiten",
      subtitle:
        "Een pagina gewijd aan de beste helden van het Universum! Het volledige archief van meer dan 63 duizend berichten van mijn X-account over kunstmatige intelligentie is hieronder beschikbaar:"
    },

    el: {
      prev: "← Προηγούμενη",
      next: "Επόμενη →",
      open: "Άνοιγμα αρχικής ανάρτησης",
      jumpTitle: "Μετάβαση στη σελίδα",
      jumpClose: "Κλείσιμο",
      subtitle:
        "Μια σελίδα αφιερωμένη στους καλύτερους ήρωες του Σύμπαντος! Το πλήρες αρχείο με περισσότερες από 63 χιλιάδες αναρτήσεις από τον λογαριασμό μου στο X σχετικά με περιεχόμενο τεχνητής νοημοσύνης είναι διαθέσιμο παρακάτω:"
    },

    sv: {
      prev: "← Föregående",
      next: "Nästa →",
      open: "Öppna originalinlägget",
      jumpTitle: "Gå till sida",
      jumpClose: "Stäng",
      subtitle:
        "En sida tillägnad universums bästa hjältar! Det fullständiga arkivet med över 63 tusen inlägg från mitt X-konto om innehåll relaterat till artificiell intelligens finns nedan:"
    },

    cs: {
      prev: "← Předchozí",
      next: "Další →",
      open: "Otevřít původní příspěvek",
      jumpTitle: "Přejít na stránku",
      jumpClose: "Zavřít",
      subtitle:
        "Stránka věnovaná nejlepším hrdinům vesmíru! Kompletní archiv více než 63 tisíc příspěvků z mého účtu X souvisejících s obsahem o umělé inteligenci je k dispozici níže:"
    },

    ro: {
      prev: "← Anterior",
      next: "Următoarea →",
      open: "Deschide postarea originală",
      jumpTitle: "Mergi la pagina",
      jumpClose: "Închide",
      subtitle:
        "O pagină dedicată celor mai buni eroi ai Universului! Arhiva completă de peste 63 de mii de postări de pe contul meu X despre conținut legat de inteligența artificială este disponibilă mai jos:"
    },

    hu: {
      prev: "← Előző",
      next: "Következő →",
      open: "Eredeti bejegyzés megnyitása",
      jumpTitle: "Ugrás az oldalra",
      jumpClose: "Bezárás",
      subtitle:
        "Az Univerzum legjobb hőseinek szentelt oldal! Az X-fiókomból származó, mesterséges intelligenciával kapcsolatos több mint 63 ezer bejegyzés teljes archívuma alább érhető el:"
    }
  };
}

/* ================= PAGE ================= */

function renderPage(tweets, pageNum, totalPages) {
  const tweetsHtml = tweets.map(renderTweet).join("\n");

  const subtitle =
    "Página dedicada aos melhores heróis do Universo! Todo o acervo de 63.023 publicações da minha conta do \"X\", relacionado a conteúdo de Inteligência Artificial, está disponível abaixo:";

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

fs.writeFileSync(
  path.join(PUBLIC_DIR, "index.html"),
  `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=/page/1.html">
<title>Supergirl(MAID)</title>
</head>
<body>
<p>Redirecionando para a página inicial...</p>
<p><a href="/page/1.html">Clique aqui se o redirecionamento não ocorrer.</a></p>
</body>
</html>`,
  "utf8"
);

console.log("OK:", totalPages);
}

main().catch(console.error);