// ViewCEMAC — Page détail d'une valeur
// Lit ?ticker=XXX&market=bvmac|forex|matieres|crypto, interroge l'API
// et affiche tout ce qu'elle fournit. DOM pur + textContent (CSP).
const BACKEND = "https://tradinggab-backend-2.onrender.com";
const ENDPOINTS = {
  bvmac: "/api/marches/bvmac",
  forex: "/api/marches/forex",
  matieres: "/api/marches/matieres",
  crypto: "/api/marches/crypto",
};
const MARKET_NAMES = { bvmac: "BVMAC", forex: "Forex", matieres: "Matières premières", crypto: "Crypto" };

const params = new URLSearchParams(location.search);
const ticker = params.get("ticker");
const market = ENDPOINTS[params.get("market")] ? params.get("market") : "bvmac";

const nf0 = (n) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const nf2 = (n) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const time = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function changeClass(pct) {
  if (pct === null || pct === undefined) return "flat";
  return pct > 0 ? "up" : pct < 0 ? "down" : "flat";
}
function formatChange(pct) {
  if (pct === null || pct === undefined) return "—";
  if (pct === 0) return "0,0 %";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")} %`;
}

const CONFIG = {
  bvmac: {
    match: "ticker",
    price: (i) => `${nf0(i.price)} FCFA`,
    fields: [
      ["Volume", (i) => (i.volume != null ? String(i.volume) : "—")],
      ["Données de", (i) => (i.scraped_at ? time(i.scraped_at) : "—")],
    ],
  },
  forex: {
    match: "pair",
    price: (i) => nf2(i.rate),
    fields: [],
  },
  matieres: {
    match: "symbol",
    price: (i) => `${nf2(i.price)} ${i.unit || ""}`,
    fields: [["Note", (i) => i.africa_note || "—"]],
  },
  crypto: {
    match: "ticker",
    price: (i) => "$ " + nf0(i.priceUSD),
    fields: [],
  },
};

const el = (id) => document.getElementById(id);
function text(id, v) { const n = el(id); if (n) n.textContent = v; }

function addRow(label, value) {
  const info = el("d-info");
  if (!info) return;
  const row = document.createElement("div");
  row.className = "info-row";
  const l = document.createElement("span");
  l.textContent = label;
  const v = document.createElement("span");
  v.textContent = value;
  row.append(l, v);
  info.appendChild(row);
}

async function load() {
  if (!ticker) { text("d-name", "Valeur inconnue"); return; }
  const cfg = CONFIG[market];
  try {
    const res = await fetch(BACKEND + ENDPOINTS[market]);
    if (!res.ok) throw new Error("backend KO");
    const { data } = await res.json();
    const item = (data || []).find((d) => d[cfg.match] === ticker);
    if (!item) { text("d-name", `${ticker} introuvable`); return; }

    const code = item.ticker || item.symbol || item.pair || ticker;
    const name = item.name || code;
    text("d-avatar", code.slice(0, 2).toUpperCase());
    text("d-name", name);
    text("d-market", MARKET_NAMES[market]);

    text("d-price", cfg.price(item));
    const chg = el("d-change");
    const pct = item.change_pct ?? null;
    chg.textContent = formatChange(pct);
    chg.className = `hero-change ${changeClass(pct)}`;

    cfg.fields.forEach(([label, fn]) => addRow(label, fn(item)));

    // ✅ #13 : historique / sparkline (silencieux si indisponible)
    loadSparkline(code, market);
  } catch {
    text("d-name", "Serveur injoignable");
    addRow("Statut", "Réessaie dans un instant (veille Render)");
  }
}

load();

// ✅ #13 : sparkline d'historique (canvas vanilla — aucune librairie, CSP-safe)
const COLORS = { up: "#2EBD85", down: "#F6465D" };

function drawSparkline(points) {
  const canvas = document.getElementById("d-chart");
  if (!canvas || points.length < 2) return false;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300;
  const h = 160;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? COLORS.up : COLORS.down;
  const pad = 6;
  const n = prices.length;
  const x = (i) => pad + (i / (n - 1)) * (w - 2 * pad);
  const y = (p) => h - pad - ((p - min) / span) * (h - 2 * pad);

  // Aire dégradée sous la courbe
  ctx.beginPath();
  ctx.moveTo(x(0), y(prices[0]));
  prices.forEach((p, i) => ctx.lineTo(x(i), y(p)));
  ctx.lineTo(x(n - 1), h);
  ctx.lineTo(x(0), h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, up ? "rgba(46,189,133,0.25)" : "rgba(246,70,93,0.25)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Ligne
  ctx.beginPath();
  ctx.moveTo(x(0), y(prices[0]));
  prices.forEach((p, i) => ctx.lineTo(x(i), y(p)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Point final
  ctx.beginPath();
  ctx.arc(x(n - 1), y(prices[n - 1]), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  return true;
}

async function loadSparkline(ticker, market) {
  // L'historique n'existe pour l'instant que pour la BVMAC
  if (market !== "bvmac") return;
  try {
    const res = await fetch(
      `${BACKEND}/api/marches/${encodeURIComponent(market)}/${encodeURIComponent(ticker)}/historique?limit=48`
    );
    if (!res.ok) return; // endpoint backend pas encore déployé → silence
    const { data } = await res.json();
    if (drawSparkline(data || [])) {
      document.getElementById("d-chart-wrap").style.display = "";
    } else if (data && data.length > 0) {
      document.getElementById("d-chart-note").style.display = "block";
    }
  } catch {
    /* backend injoignable : pas de graphique, pas de message */
  }
}


// ================= ✅ #17 : Notifications push + alertes =================
const getToken = () => localStorage.getItem("viewcemac_token");

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function activerNotifications() {
  const btn = document.getElementById("btn-notif");
  const msg = document.getElementById("alerte-msg");
  if (!getToken()) { window.location.href = "auth.html"; return; }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    msg.textContent = "❌ Ce navigateur ne supporte pas les notifications push.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Activation…";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      msg.textContent = "❌ Permission refusée. Autorise les notifications pour viewcemac.vercel.app dans les réglages de Chrome.";
      btn.disabled = false;
      btn.textContent = "🔔 Activer les notifications";
      return;
    }
    const { publicKey } = await (await fetch(`${BACKEND}/api/notifications/vapid-public-key`)).json();
    if (!publicKey) throw new Error("clé VAPID indisponible");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const res = await fetch(`${BACKEND}/api/notifications/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!res.ok) throw new Error("enregistrement échoué");
    btn.textContent = "🔔 Notifications activées ✓";
    document.getElementById("alerte-form").style.display = "";
    msg.textContent = "";
  } catch (e) {
    msg.textContent = "❌ Activation impossible : " + e.message;
    btn.disabled = false;
    btn.textContent = "🔔 Activer les notifications";
  }
}

async function creerAlerte() {
  const msg = document.getElementById("alerte-msg");
  const prix = Number(document.getElementById("alerte-prix").value);
  const direction = document.getElementById("alerte-direction").value;
  if (!Number.isFinite(prix) || prix <= 0) {
    msg.textContent = "❌ Entre un prix cible valide.";
    return;
  }
  try {
    const res = await fetch(`${BACKEND}/api/alertes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ marche: market, ticker: (params.get("ticker") || "").toUpperCase(), prix_cible: prix, direction }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "création échouée");
    msg.textContent = "✅ Alerte créée ! Tu seras notifié quand le prix la franchira.";
    document.getElementById("alerte-prix").value = "";
    chargerAlertes();
  } catch (e) {
    msg.textContent = "❌ " + e.message;
  }
}

async function chargerAlertes() {
  const box = document.getElementById("alerte-liste");
  if (!box || !getToken()) return;
  try {
    const res = await fetch(`${BACKEND}/api/alertes`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const { alertes } = await res.json();
    const code = (params.get("ticker") || "").toUpperCase();
    const miennes = (alertes || []).filter(
      (a) => a.marche === market && a.ticker === code
    );
    box.textContent = "";
    miennes.forEach((a) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;justify-content:space-between;align-items:center;background:var(--panel-2);border:1px solid var(--border);border-radius:10px;padding:9px 12px;font-size:0.82rem";
      const label = document.createElement("span");
      label.textContent = `${a.direction} de ${Number(a.prix_cible).toLocaleString("fr-FR")}${a.active ? "" : " — déclenchée ✓"}`;
      if (!a.active) label.style.color = "var(--dim)";
      const btn = document.createElement("button");
      btn.textContent = "✕";
      btn.style.cssText = "background:none;border:none;color:var(--down);cursor:pointer;font-size:1rem";
      btn.addEventListener("click", async () => {
        await fetch(`${BACKEND}/api/alertes/${a.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        chargerAlertes();
      });
      row.append(label, btn);
      box.appendChild(row);
    });
  } catch { /* silencieux */ }
}

// Branchement
document.getElementById("btn-notif")?.addEventListener("click", activerNotifications);
document.getElementById("alerte-creer")?.addEventListener("click", creerAlerte);
// Si déjà connecté, on pré-remplit l'état
if (getToken()) chargerAlertes();
