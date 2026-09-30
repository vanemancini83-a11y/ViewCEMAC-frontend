// ✅ Bouton œil (afficher/masquer) sur chaque champ mot de passe
document.querySelectorAll('input[type="password"]').forEach((input) => {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.innerHTML = "👁️";
  toggle.setAttribute("aria-label", "Afficher le mot de passe");
  toggle.style.cssText =
    "position:absolute;right:12px;top:50%;transform:translateY(-50%);" +
    "background:none;border:none;cursor:pointer;font-size:18px;padding:4px;";
  wrapper.appendChild(toggle);

  toggle.addEventListener("click", () => {
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    toggle.innerHTML = visible ? "🙈" : "👁️";
  });
});

const API_URL = "https://tradinggab-backend-2.onrender.com";
const errorBox = document.getElementById("pwd-error");
const form = document.getElementById("pwd-form");
const btn = document.getElementById("pwd-submit");

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";

  const token = localStorage.getItem("viewcemac_token");
  if (!token) { window.location.href = "auth.html"; return; }

  const ancien = document.getElementById("ancien").value.trim();
  const nouveau = document.getElementById("nouveau").value.trim();
  const confirmation = document.getElementById("confirmation").value.trim();

  if (nouveau !== confirmation) { showError("La confirmation ne correspond pas au nouveau mot de passe."); return; }
  if (nouveau.length < 8) { showError("Au moins 8 caractères."); return; }

  btn.disabled = true;
  btn.textContent = "Modification…";

  try {
    const res = await fetch(`${API_URL}/api/compte/mot-de-passe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ancien, nouveau }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur");

    // Succès : on nettoie la session et on renvoie vers la connexion
    localStorage.removeItem("viewcemac_token");
    localStorage.removeItem("viewcemac_user_id");
    localStorage.removeItem("viewcemac_is_premium");
    alert("Mot de passe modifié ✅ Reconnecte-toi avec le nouveau.");
    window.location.href = "auth.html";
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Changer le mot de passe";
  }
});
