window.addEventListener("error", function (e) {
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<pre style="background:#F6465D;color:#fff;padding:12px;white-space:pre-wrap;font-size:14px;z-index:9999;position:relative;">ERREUR JS : ${e.message}\n${e.filename}:${e.lineno}</pre>`
  );
});

const BACKEND_BASE_URL = "https://tradinggab-backend-2.onrender.com";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12000; // ✅ 12 s max d'attente du backend avant bascule sur les données de secours

const SAMPLE_BVMAC = {
  success: true,
  data: [
    { ticker: "BANGE", name: "BANGE", price: 223255, change: 0, change_pct: 0, volume: 0 },
    { ticker: "BGFIHC", name: "BGFI HC", price: 90001, change: 0, change_pct: 0, volume: 0 },
    { ticker: "REGIONALE", name: "REGIONALE", price: 39000, change: 0, change_pct: 0, volume: 0 },
    { ticker: "SAFACAM", name: "SAFACAM", price: 35100, change: 0, change_pct: 0, volume: 0 },
    { ticker: "SCGRE", name: "SCG-Ré", price: 20000, change: 0, change_pct: 0, volume: 0 },
    { ticker: "SEMC", name: "SEMC", price: 53000, change: 0, change_pct: 0, volume: 0 },
    { ticker: "SOCAPALM", name: "SOCAPALM", price: 50000, change: 0, change_pct: 2.1, volume: 2 },
  ],
};
const SAMPLE_FOREX = {
  success: true,
  data: [
    { pair: "USD/XAF", rate: 605.50 }, { pair: "USD/EUR", rate: 0.92 },
    { pair: "USD/GBP", rate: 0.79 }, { pair: "USD/CNY", rate: 7.23 },
  ],
};
const SAMPLE_MATIERES = {
  success: true,
  data: [
    { symbol: "BRENT", name: "Pétrole Brent", price: 82.50, unit: "$/baril", change_pct: 1.2, africa_note: "Impact direct sur les coûts de transport en zone CEMAC." },
    { symbol: "COCOA", name: "Cacao", price: 9850.00, unit: "$/tonne", change_pct: -0.5, africa_note: "Le Cameroun et la Côte d'Ivoire sont des acteurs majeurs." },
    { symbol: "GOLD", name: "Or", price: 2340.00, unit: "$/once", change_pct: 0.8, africa_note: "Valeur refuge en période d'inflation." },
  ],
};
// ✅ Fallback crypto : évite l'écran vide quand le backend est indisponible
const SAMPLE_CRYPTO = {
  success: true,
  data: [
    { ticker: "BTC", priceUSD: 64000, change_pct: 1.2 },
    { ticker: "ETH", priceUSD: 3400, change_pct: -0.8 },
    { ticker: "BNB", priceUSD: 590, change_pct: 0.4 },
    { ticker: "SOL", priceUSD: 148, change_pct: 2.1 },
  ],
};

const state = { market: "bvmac", bvmac: null, isPremium: false };
let currentRequestId = 0;

function formatFCFA(value) {
  return new Intl.NumberFormat("fr-FR").format(value) + " FCFA";
}
function changeClass(pct) {
  if (pct === null || pct === undefined) return "flat";
  return pct > 0 ? "up" : pct < 0 ? "down" : "flat";
}
function formatChange(pct) {
  if (pct === null || pct === undefined) return "—";
  if (pct === 0) return "0,0 %";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")} %`;
}

const RELEVANT_FOREX_PAIRS = ["USD/XAF", "USD/EUR", "USD/GBP", "USD/CNY"];
const RELEVANT_COMMODITIES = ["BRENT", "COCOA", "COFFEE", "PALM_OIL", "RUBBER", "GOLD"];

function adaptCrypto(raw) {
  return { ticker: raw.ticker, name: raw.ticker === "BTC" ? "Bitcoin" : raw.ticker === "ETH" ? "Ethereum" : raw.ticker === "BNB" ? "BNB" : "Solana",
    price: raw.priceUSD,
    priceDisplay: "$ " + raw.priceUSD.toLocaleString("fr-FR", { maximumFractionDigits: 0 }),
    change_pct: raw.change_pct ?? null };
}

const FOREX_NAMES = {
  "USD/XAF": "Dollar / Franc CFA",
  "USD/EUR": "Dollar / Euro",
  "USD/GBP": "Dollar / Livre sterling",
  "USD/CNY": "Dollar / Yuan",
};
function adaptForex(raw) {
  return { ticker: raw.pair, name: FOREX_NAMES[raw.pair] || raw.pair, price: raw.rate,
    priceDisplay: raw.rate.toLocaleString("fr-FR", { maximumFractionDigits: 4 }), change_pct: null };
}
// ✅ Unités raccourcies façon app de trading (évite les débordements)
const UNIT_SHORT = {
  "USD per metric ton": "$/t",
  "USD per tonne": "$/t",
  "USD per barrel": "$/baril",
  "US cents per lb": "¢/lb",
  "US cents per pound": "¢/lb",
  "USD per troy ounce": "$/oz",
  "USD per troy oz": "$/oz",
  "USD per bushel": "$/boisseau",
};
// ✅ Sécurité : tout format "USD per xxx" ou "US cents per xxx" non listé
// est raccourci automatiquement pour éviter tout débordement.
function shortUnit(u) {
  if (UNIT_SHORT[u]) return UNIT_SHORT[u];
  if (/^USD per (.+)$/i.test(u)) return "$/" + RegExp.$1.split(" ")[0];
  if (/^US cents per (.+)$/i.test(u)) return "¢/" + RegExp.$1.split(" ")[0];
  return u;
}

function adaptCommodity(raw) {
  return { ticker: raw.symbol, name: raw.name, price: raw.price,
    priceDisplay: `${raw.price.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${shortUnit(raw.unit)}`,
    change_pct: raw.change_pct ?? null, note: raw.africa_note };
}

async function fetchMarket(market) {
  const endpoints = { bvmac: "/api/marches/bvmac", forex: "/api/marches/forex", matieres: "/api/marches/matieres", crypto: "/api/marches/crypto" };
  const token = localStorage.getItem("viewcemac_token");
  // ✅ Timeout : évite d'attendre indéfiniment un backend en veille/planté
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BACKEND_BASE_URL}${endpoints[market]}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("Réponse backend non OK");
    const result = await res.json();
    clearTimeout(timeoutId);
    const isPremium = !!result.isPremium;
    const total = result.total ?? 0;
    if (market === "crypto") {
      const all = result.data || [];
      return { success: true, data: all.map(adaptCrypto), isPremium, total };
    }
    if (market === "forex") {
      // ✅ Ordre pertinent : USD/XAF (la paire CEMAC) en premier
      const filtered = (result.data || [])
        .filter((r) => RELEVANT_FOREX_PAIRS.includes(r.pair))
        .sort((a, b) => RELEVANT_FOREX_PAIRS.indexOf(a.pair) - RELEVANT_FOREX_PAIRS.indexOf(b.pair));
      return { success: true, data: filtered.map(adaptForex), isPremium, total };
    }
    if (market === "matieres") {
      const filtered = (result.data || []).filter((r) => RELEVANT_COMMODITIES.includes(r.symbol));
      return { success: true, data: filtered.map(adaptCommodity), isPremium, total };
    }
    return { success: true, data: result.data || [], isPremium, total };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`Backend indisponible pour ${market}`, err);
    const fallback = market === "bvmac" ? SAMPLE_BVMAC
      : market === "forex" ? SAMPLE_FOREX
      : market === "matieres" ? SAMPLE_MATIERES
      : SAMPLE_CRYPTO; // ✅ crypto : données de secours au lieu d'une liste vide
    return { ...fallback, isPremium: false, total: fallback.data.length, fromFallback: true };
  }
}

function renderPulse(items) {
  const track = document.getElementById("pulse-track");
  if (!track) return;
  if (!items.length) { track.innerHTML = ""; return; }
  const doubled = [...items, ...items];
  track.innerHTML = doubled.map((item) => `
    <span class="pulse-item">
      <span class="ticker">${item.ticker}</span>
      <span>${formatFCFA(item.price)}</span>
      <span class="${changeClass(item.change_pct)}">${formatChange(item.change_pct)}</span>
    </span>`).join("");
}

function renderHero(items) {
  const featured = items.find((i) => i.ticker === "BGFIHC") || items[0];
  const nameEl = document.getElementById("hero-name");
  const priceEl = document.getElementById("hero-price");
  const changeEl = document.getElementById("hero-change");
  if (!featured || !nameEl || !priceEl || !changeEl) return;
  nameEl.textContent = featured.name;
  priceEl.textContent = formatFCFA(featured.price);
  changeEl.textContent = formatChange(featured.change_pct);
  changeEl.className = `hero-change ${changeClass(featured.change_pct)}`;
}

function renderOfflineBanner(isOffline) {
  let banner = document.getElementById("offline-banner");
  if (isOffline) {
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "offline-banner";
      banner.style.cssText = "background:#8a6d1d;color:#fff;text-align:center;padding:8px 12px;font-size:13px;font-family:'IBM Plex Sans',sans-serif;";
      banner.textContent = "⚠️ Connexion au serveur impossible — données de démonstration affichées.";
      const header = document.querySelector(".app-header");
      header ? header.insertAdjacentElement("afterend", banner) : document.body.insertAdjacentElement("afterbegin", banner);
    }
  } else if (banner) banner.remove();
}

function renderLoadingList() {
  const list = document.getElementById("list");
  if (!list) return;
  list.innerHTML = `<p class="empty-message" style="text-align:center;padding:24px;">Chargement des données…</p>`;
}

function renderList(items, market, meta = {}) {
  const list = document.getElementById("list");
  if (!list) return;
  const isPremium = !!meta.isPremium;
  const total = meta.total ?? items.length;
  const lockedCount = isPremium ? 0 : Math.max(0, total - items.length);

  if (!items.length && !lockedCount) {
    list.innerHTML = `<p class="empty-message" style="text-align:center;padding:20px;">Aucune donnée disponible pour le moment.</p>`;
    return;
  }

  let html = items.map((item) => {
    const initials = item.ticker.slice(0, 2).toUpperCase();
    const cls = changeClass(item.change_pct);
    const priceText = item.priceDisplay || formatFCFA(item.price);
    return `
    <div class="m-row">
      <div class="m-row__left">
        <div class="m-row__avatar">${initials}</div>
        <div class="m-row__names">
          <span class="m-row__ticker">${item.ticker}</span>
          <span class="m-row__name">${item.name}</span>
        </div>
      </div>
      <div class="m-row__right">
        <span class="m-row__price">${priceText}</span>
        <span class="m-row__chg m-row__chg--${cls}">${formatChange(item.change_pct)}</span>
      </div>
    </div>
    ${item.note ? `<div class="m-note">${item.note}</div>` : ""}`;
  }).join("");

  if (lockedCount > 0) {
    const label = market === "forex" ? "paire" : market === "matieres" ? "matière" : "valeur";
    const plural = lockedCount > 1 ? "s" : "";
    html += `
    <button class="locked-cta" type="button">
      <span class="locked-cta-count">+${lockedCount} ${label}${plural} de plus</span>
      <span class="locked-cta-action">Débloquer — 2 000 FCFA / mois →</span>
    </button>`;
  }
  if (market === "crypto") {
    html += `<div class="m-note" style="margin:-6px 0 0;border-radius:var(--radius);border:1px dashed var(--border)">Les cryptomonnaies sont volatiles et ne sont pas régulées en zone CEMAC — informations uniquement, pas un conseil d'investissement.</div>`;
  }

  list.innerHTML = html;

  const cta = list.querySelector(".locked-cta");
  if (cta) cta.addEventListener("click", () => document.querySelector(".premium-cta")?.click());
}

function renderFreshness() {
  const el = document.getElementById("freshness-text");
  if (!el) return;
  const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  el.textContent = `Mis à jour à ${time}`;
}

async function loadMarket(market) {
  const requestId = ++currentRequestId;
  state.market = market;
  renderLoadingList();
  const result = await fetchMarket(market);
  if (requestId !== currentRequestId || state.market !== market) return;

  const items = result.data || [];
  state.isPremium = !!result.isPremium;
  localStorage.setItem("viewcemac_is_premium", state.isPremium ? "1" : "0");
  refreshPremiumCta(state.isPremium);
  renderOfflineBanner(!!result.fromFallback);

  if (market === "bvmac") {
    state.bvmac = items;
    renderHero(items);
    renderPulse(items);
  }
  renderList(items, market, result);
  renderFreshness();
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    loadMarket(tab.dataset.market);
  }));
}

function setupPasswordLink() {
  const btn = document.getElementById("password-link");
  if (!btn) return;
  const logged = !!localStorage.getItem("viewcemac_token");
  btn.style.display = logged ? "" : "none";
  btn.addEventListener("click", () => { window.location.href = "compte.html"; });
}

function setupAccountLink() {
  setupPasswordLink();
  const btn = document.getElementById("account-link");
  if (!btn) return;
  btn.textContent = localStorage.getItem("viewcemac_token") ? "Déconnexion" : "Se connecter";
  btn.addEventListener("click", () => {
    if (localStorage.getItem("viewcemac_token")) {
      localStorage.removeItem("viewcemac_token");
      localStorage.removeItem("viewcemac_user_id");
      localStorage.removeItem("viewcemac_is_premium");
      window.location.reload();
    } else {
      window.location.href = "auth.html";
    }
  });
}

function refreshPremiumCta(isPremium) {
  const card = document.querySelector(".premium-card");
  const btn = document.querySelector(".premium-cta");
  if (!card || !btn) return;
  const title = card.querySelector(".premium-title");
  const price = card.querySelector(".premium-price");
  const copy = card.querySelector(".premium-copy");
  if (isPremium) {
    // ✅ Abonné : on masque le prix, on félicite
    card.classList.add("is-active");
    if (title) title.textContent = "Premium actif 🎉";
    if (price) price.style.display = "none";
    if (copy) copy.textContent = "Merci ! Vous avez accès à toutes les valeurs, au forex complet et à toutes les matières premières.";
    btn.textContent = "Abonnement actif ✓";
    btn.disabled = true;
  } else {
    card.classList.remove("is-active");
    if (title) title.textContent = "Passe en Premium";
    if (price) price.style.display = "";
    if (copy) copy.textContent = "Toutes les valeurs BVMAC, le forex complet et toutes les matières premières, sans limite.";
    btn.textContent = "Passer Premium — 2 000 FCFA / mois";
    btn.disabled = false;
  }
}

function setupAccountLinkRefresh() {
  const btn = document.getElementById("account-link");
  if (btn) btn.textContent = "Se connecter";
}

async function loadProfile() {
  const token = localStorage.getItem("viewcemac_token");
  if (!token) return;
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      localStorage.removeItem("viewcemac_token");
      localStorage.removeItem("viewcemac_user_id");
      localStorage.removeItem("viewcemac_is_premium");
      setupAccountLinkRefresh();
      return;
    }
    if (!res.ok) return;
    const { isPremium } = await res.json();
    localStorage.setItem("viewcemac_is_premium", isPremium ? "1" : "0");
    refreshPremiumCta(isPremium);
  } catch { /* silencieux */ }
}

const PAIEMENT_MANUEL_NUMERO = "066 59 83 14 (Airtel Money) ou 074 52 28 22 (Moov Money)";

function setupPremiumButton() {
  const btn = document.querySelector(".premium-cta");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const token = localStorage.getItem("viewcemac_token");
    if (!token) { window.location.href = "auth.html"; return; }
    if (localStorage.getItem("viewcemac_is_premium") === "1") return;

    btn.disabled = true;
    btn.textContent = "Redirection…";
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/paiement/initier`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        alert("Ta session a expiré, reconnecte-toi.");
        localStorage.removeItem("viewcemac_token");
        return;
      }
      if (!res.ok) throw new Error("init impossible");
      const { paymentUrl } = await res.json();
      window.location.href = paymentUrl;
    } catch {
      btn.disabled = false;
      btn.textContent = "Passer Premium — 2 000 FCFA / mois";
      alert(
        "Paiement en ligne bientôt disponible.\n\n" +
        "Pour t'abonner maintenant :\n" +
        "1. Envoie 2 000 FCFA au :\n" +
        "   • 066 59 83 14 (Airtel Money)\n" +
        "   • 074 52 28 22 (Moov Money)\n" +
        "2. Envoie ton numéro ViewCEMAC par SMS ou WhatsApp au même numéro\n" +
        "3. Activation sous quelques minutes"
      );
    }
  });
}

async function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const transactionId = params.get("transaction") || params.get("transaction_id");
  if (!transactionId) return;
  const token = localStorage.getItem("viewcemac_token");
  if (!token) return;

  const freshness = document.getElementById("freshness-text");
  let attempts = 0;
  const maxAttempts = 12;
  const poll = async () => {
    attempts++;
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/paiement/statut/${transactionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("statut indisponible");
      const { statut } = await res.json();
      if (statut === "confirme") {
        if (freshness) freshness.textContent = "Premium activé ✓";
        await loadProfile();
        await loadMarket(state.market);
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
      if (statut === "echoue") {
        if (freshness) freshness.textContent = "Paiement échoué";
        return;
      }
      if (attempts < maxAttempts) {
        if (freshness) freshness.textContent = `Activation en cours… (${attempts * 5} s)`;
        setTimeout(poll, 5000);
      } else {
        if (freshness) freshness.textContent = "Activation en attente — recharge plus tard";
      }
    } catch {
      if (attempts < maxAttempts) setTimeout(poll, 5000);
    }
  };
  await poll();
}

function init() {
  setupTabs();
  setupPremiumButton();
  setupAccountLink();
  loadProfile();
  loadMarket(state.market);
  checkPaymentReturn();
  setInterval(() => loadMarket(state.market), REFRESH_INTERVAL_MS);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW :", err));
  }
}

document.addEventListener("DOMContentLoaded", init);
