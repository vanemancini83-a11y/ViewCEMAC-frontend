const API_URL = "https://tradinggab-backend-2.onrender.com";
const TOKEN_KEY = "viewcemac_token";
const USER_ID_KEY = "viewcemac_user_id";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const phone = (params.get("phone") || "").trim();

  const form = document.getElementById("otp-form");
  const input = document.getElementById("otp-code");
  const errorBox = document.getElementById("otp-error");
  const submitBtn = document.getElementById("otp-submit");
  const resendBtn = document.getElementById("otp-resend");
  const phoneLabel = document.getElementById("otp-phone");

  if (!phone) { window.location.href = "/auth.html"; return; }
  if (phoneLabel) phoneLabel.textContent = phone;

  function showError(msg) {
    if (errorBox) { errorBox.style.color = ""; errorBox.textContent = msg; errorBox.style.display = "block"; }
    else alert(msg);
  }
  function showInfo(msg) {
    if (errorBox) { errorBox.style.color = "#7ee2a8"; errorBox.textContent = msg; errorBox.style.display = "block"; }
  }

  // 1. Vérification du code
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.style.display = "none";
    const code = input.value.trim();
    if (!/^\d{6}$/.test(code)) { showError("Entrez le code à 6 chiffres."); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = "Vérification...";
    try {
      const response = await fetch(`${API_URL}/api/auth/verifier-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Code invalide.");
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
            if (data.refresh_token) localStorage.setItem("viewcemac_refresh", data.refresh_token);
      const userId = data.user && data.user.id;
      if (userId) localStorage.setItem(USER_ID_KEY, String(userId));

      window.location.href = "/";
    } catch (err) {
      if (err instanceof TypeError) showError("Serveur en cours de réveil (30-50 s). Réessayez.");
      else showError(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Vérifier";
    }
  });

  // 2. Renvoi du code (cooldown 60 s)
  if (resendBtn) {
    resendBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      errorBox.style.display = "none";
      resendBtn.disabled = true;
      let message = "Code renvoyé.";
      try {
        const response = await fetch(`${API_URL}/api/auth/renvoyer-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone })
        });
        const data = await response.json();
        if (!response.ok) message = data.error || "Impossible de renvoyer le code.";
      } catch (err) {
        message = "Serveur injoignable. Réessayez.";
      }
      showInfo(message);
      let sec = 60;
      resendBtn.textContent = `Renvoyer (${sec}s)`;
      const timer = setInterval(() => {
        sec -= 1;
        if (sec <= 0) {
          clearInterval(timer);
          resendBtn.disabled = false;
          resendBtn.textContent = "Renvoyer le code";
        } else {
          resendBtn.textContent = `Renvoyer (${sec}s)`;
        }
      }, 1000);
    });
  }
});
