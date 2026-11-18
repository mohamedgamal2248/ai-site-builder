/**
 * Embeddable widget (iframe): live PI/USDT price and the pressure index. Plain HTML with a few
 * lines of script, so it is tiny, needs no React, and is cached at the CDN for a day.
 * Options: ?lang=ar|en, ?theme=light|dark.
 */
const BASE = process.env.SITE_URL || "https://ai-site-builder-peach.vercel.app";

export const dynamic = "force-static";

export function GET() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Blockchain Pi widget</title>
<style>
:root{--bg:#fff;--fg:#1c1730;--mu:#6b6582;--bd:#e6e1f0;--ac:#6b3fd4;--up:#1a7f43;--dn:#b42323}
.dark{--bg:#1a1627;--fg:#ece9f6;--mu:#a39dba;--bd:#2d2742;--ac:#8462f0;--up:#5fd68f;--dn:#ff8a8a}
*{box-sizing:border-box}html,body{margin:0;background:transparent}
a.w{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--bd);border-radius:14px;background:var(--bg);color:var(--fg);text-decoration:none;font:14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",sans-serif;max-width:420px}
.lg{flex:none;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,#5b2fc9,#7d4fe6);color:#f5b83d;font:700 22px Georgia,serif}
.c{flex:1;min-width:0}.k{color:var(--mu);font-size:11.5px}.p{font-weight:800;font-size:20px;direction:ltr;display:inline-block}
.ch{font-weight:700;font-size:12.5px;margin-inline-start:6px;direction:ltr;display:inline-block}.up{color:var(--up)}.dn{color:var(--dn)}
.ix{text-align:center;flex:none}.ix b{display:block;font-size:20px;color:var(--ac)}.ft{color:var(--mu);font-size:10.5px}
</style></head><body><a class="w" id="w" href="${BASE}/" target="_blank" rel="noopener">
<span class="lg">π</span><span class="c"><span class="k" id="k">PI / USDT</span><br><span class="p" id="p">—</span><span class="ch" id="ch"></span><br><span class="ft" id="ft">Blockchain Pi</span></span>
<span class="ix"><span class="k" id="ik">Index</span><b id="ix">—</b><span class="k" id="ib"></span></span></a>
<script>
(function(){var q=new URLSearchParams(location.search),ar=q.get("lang")!=="en";
if(q.get("theme")==="dark")document.documentElement.className="dark";
document.documentElement.lang=ar?"ar":"en";document.documentElement.dir=ar?"rtl":"ltr";
var B={strong_sell:ar?"ضغط بيع قوي":"Strong sell",sell:ar?"ميل للبيع":"Leaning sell",neutral:ar?"محايد":"Neutral",buy:ar?"ميل للشراء":"Leaning buy",strong_buy:ar?"ضغط شراء قوي":"Strong buy"};
document.getElementById("ik").textContent=ar?"مؤشر الضغط":"Pressure index";
document.getElementById("ft").textContent=ar?"Blockchain Pi · مش نصيحة استثمار":"Blockchain Pi · not investment advice";
function price(){fetch("https://www.okx.com/api/v5/market/ticker?instId=PI-USDT").then(function(r){return r.json()}).then(function(j){var d=j.data&&j.data[0];if(!d)return;var l=+d.last,o=+d.open24h,c=o?(l-o)/o*100:0;
document.getElementById("p").textContent="$"+l.toFixed(4);var e=document.getElementById("ch");e.textContent=(c>=0?"▲ ":"▼ ")+Math.abs(c).toFixed(2)+"%";e.className="ch "+(c>=0?"up":"dn")}).catch(function(){})}
function index(){fetch("/api/v1/index").then(function(r){return r.json()}).then(function(j){if(j.score==null)return;document.getElementById("ix").textContent=Math.round(j.score);document.getElementById("ib").textContent=B[j.band]||""}).catch(function(){})}
price();index();setInterval(function(){if(!document.hidden)price()},30000);setInterval(function(){if(!document.hidden)index()},300000);})();
</script></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
