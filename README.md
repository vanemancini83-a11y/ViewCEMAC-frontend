ViewCEMAC

Le regard sur les marchés CEMAC.

Cotations en direct de la BVMAC, forex (USD/XAF), matières premières et cryptomonnaies pour la zone CEMAC.

🔗 [Démo en ligne](https://viewcemac.vercel.app)

![Screenshot](screenshot.png) 

Fonctionnalités

- 📈 BVMAC — valeurs cotées en temps réel avec variation et volume
- 💱 Forex — paires USD/XAF, USD/EUR, USD/GBP, USD/CNY
- 🛢️ Matières premières — pétrole, cacao, or et autres avec contexte africain
- ₿ Crypto — Bitcoin, Ethereum, BNB, Solana
- 🔒 Authentification — connexion par numéro de téléphone
- ⭐ Premium — accès illimité via paiement mobile (Airtel Money / Moov Money)
- 📱 PWA — installable sur mobile, fonctionne hors ligne avec données de secours

Stack

Couche	Technologie	
Frontend	HTML5, CSS3, JavaScript vanilla (PWA)	
Hébergement frontend	[Vercel](https://vercel.com)	
Backend	Node.js / Express (REST API)	
Hébergement backend	[Render](https://render.com)	
Données	Mansa Markets (scraping BVMAC, forex, matières premières)	

Structure du frontend

```
ViewCEMAC-frontend/
├── index.html          # Page d'accueil
├── app.js              # Logique marchés, sécurité, PWA
├── styles.css          # Charte graphique (inspirée Binance)
├── sw.js               # Service Worker (cache-first, hors ligne)
├── auth.html / auth.js # Connexion & inscription
├── compte.html / compte.js # Changement de mot de passe
├── privacy.html        # Politique de confidentialité
├── manifest.json       # PWA manifest
└── icons/              # Icônes 192×192 & 512×512
```

Lancer en local

```bash
git clone https://github.com/vanemancini83-a11y/ViewCEMAC-frontend.git
cd ViewCEMAC-frontend
# Ouvrir index.html dans un navigateur, ou :
npx serve .
```

> Le backend doit être accessible (`tradinggab-backend-2.onrender.com`) pour les données en direct. En son absence, l'app bascule sur des données de démonstration.

Sécurité

- ✅ CSP stricte (`script-src 'self'`)
- ✅ Pas de `innerHTML` avec données API (DOM pur + `textContent`)
- ✅ Headers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- 🔒 Token stocké en `localStorage` (migration vers cookie `HttpOnly` prévue)

Roadmap

- Graphiques sparkline d'historique
- Page détail par valeur (historique, volume)
- Recherche / tri des valeurs
- Notifications push de prix
- Intégration PSP (paiement automatique)

Licence

MIT — libre d'utilisation et de modification.

---

Données fournies par Mansa Markets. ViewCEMAC n'est pas un conseiller en investissement.
