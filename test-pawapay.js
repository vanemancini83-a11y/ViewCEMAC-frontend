// 🔬 Test token pawaPay — page temporaire de diagnostic
const btn = document.getElementById("go");
const ta = document.getElementById("token");
const out = document.getElementById("out");

btn.addEventListener("click", async () => {
  const token = ta.value.trim();
  if (!token) {
    out.textContent = "Colle d'abord le token dans le champ ci-dessus.";
    return;
  }
  out.textContent = "Test en cours… (le serveur Render peut mettre jusqu'à 50 s à se réveiller)";
  btn.disabled = true;
  try {
    const r = await fetch("https://tradinggab-backend-2.onrender.com/api/paiement/test-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await r.json();
    out.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    out.textContent = "Erreur réseau : " + e.message + "\nRéessaie dans un instant (serveur en veille ?).";
  } finally {
    btn.disabled = false;
  }
});
