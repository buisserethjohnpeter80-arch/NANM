/* NANM v1 — logique (vanilla JS). Commentaires courts en français. */
// URL publique de l'API (seule constante publique).
const API_BASE = "https://lavi-ansanm-api.buisserethjohnpeter80.workers.dev";
const TOKEN_KEY = "nanm_token";
const USER_KEY = "nanm_user";

// --- Helpers DOM ---
const $ = (id) => document.getElementById(id);
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");
const showError = (el, msg) => { if (!el) return; if (!msg) { hide(el); return; } el.textContent = msg; show(el); };
function toast(msg) { const t = $("toast"); if (t) { t.message = msg; t.present(); } }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// --- Helpers données ---
function absoluteUrl(path) { if (!path) return null; if (path.startsWith("http")) return path; return API_BASE + path; }
function initials(name) { const parts = String(name || "N").trim().split(/\s+/); const a = (parts[0] || "N")[0] || "N"; const b = parts.length > 1 ? (parts[parts.length - 1][0] || "") : ""; return (a + b).toUpperCase(); }
function avatarHtml(user, sizeClass) { const url = user && user.photo_url ? absoluteUrl(user.photo_url) : (user && user.photoUrl ? user.photoUrl : null); if (url) return '<span class="avatar ' + (sizeClass || "") + '"><img src="' + escapeHtml(url) + '" alt="" /></span>'; return '<span class="avatar ' + (sizeClass || "") + '">' + escapeHtml(initials(user ? user.name : "N")) + '</span>'; }
function timeAgo(iso) { if (!iso) return ""; const dt = new Date(iso); const diff = Date.now() - dt.getTime(); if (isNaN(dt.getTime())) return ""; if (diff < 60000) return "À l'instant"; if (diff < 3600000) return "Il y a " + Math.floor(diff / 60000) + " min"; if (diff < 86400000) return "Il y a " + Math.floor(diff / 3600000) + " h"; if (diff < 604800000) return "Il y a " + Math.floor(diff / 86400000) + " j"; return dt.getDate() + "/" + (dt.getMonth() + 1) + "/" + dt.getFullYear(); }
function todayISO() { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0"); }

// --- État ---
let currentUser = null;
let feedPosts = [];
let allEvents = [];
let eventFilter = "avenir";
let conversations = [];
let activeConv = null; // {id, other}
let pollTimer = null;

// --- API ---
function getToken() { return localStorage.getItem(TOKEN_KEY); }
async function api(path, opts) { const options = opts || {}; const headers = {}; if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json"; const token = getToken(); if (token) headers["Authorization"] = "Bearer " + token; const res = await fetch(API_BASE + path, { method: options.method || "GET", headers, body: options.body }); let data = {}; try { data = await res.json(); } catch (e) { /* corps vide */ } if (res.status >= 400) throw new Error((data && data.error) || "Erreur inattendue."); return data; }

// --- Auth : navigation ---
function showAuthScreen(name) { ["welcome", "login", "signup", "profile-setup"].forEach((n) => { const el = $("screen-" + n); if (el) el.classList.toggle("hidden", n !== name); }); }
function showApp() { hide($("auth-view")); show($("main-tabs")); startPolling(); }
function showAuth() { show($("auth-view")); hide($("main-tabs")); showAuthScreen("welcome"); stopPolling(); }

async function loadMe() { try { const data = await api("/api/me"); currentUser = data.user; localStorage.setItem(USER_KEY, JSON.stringify(currentUser)); return currentUser; } catch (e) { currentUser = null; localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); return null; } }

async function handleLogin() { const email = $("login-email").value.trim(); const password = $("login-password").value; showError($("login-error"), ""); try { const data = await api("/api/login", { method: "POST", body: JSON.stringify({ email, password }) }); localStorage.setItem(TOKEN_KEY, data.token); currentUser = data.user; await afterAuth(false); } catch (e) { showError($("login-error"), e.message); } }

async function handleSignup() { const name = $("signup-name").value.trim(); const email = $("signup-email").value.trim(); const password = $("signup-password").value; showError($("signup-error"), ""); try { const data = await api("/api/signup", { method: "POST", body: JSON.stringify({ name, email, password }) }); localStorage.setItem(TOKEN_KEY, data.token); currentUser = data.user; const file = $("signup-photo").files[0]; if (file) { const fd = new FormData(); fd.append("photo", file); try { const up = await api("/api/me/photo", { method: "POST", body: fd }); currentUser = up.user; } catch (e) { /* photo optionnelle : on continue */ } } $("setup-avatar-initials").textContent = initials(currentUser.name); showAuthScreen("profile-setup"); } catch (e) { showError($("signup-error"), e.message); } }

async function handleSetupSave() { const bio = $("setup-bio").value; showError($("setup-error"), ""); try { if (bio.trim()) { const data = await api("/api/me", { method: "PUT", body: JSON.stringify({ bio: bio.slice(0, 300) }) }); currentUser = data.user; } await afterAuth(true); } catch (e) { showError($("setup-error"), e.message); } }

async function afterAuth(isNew) { await loadFeed(); await loadEvents(); await loadConversations(); renderProfile(); showApp(); if (isNew) toast("Bienvenue sur NANM !"); else toast("Bon retour !"); }
function logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); currentUser = null; activeConv = null; hide($("chat-view")); showAuth(); }

// --- Feed ---
async function loadFeed() { try { const data = await api("/api/feed"); feedPosts = data.posts || []; renderFeed(); renderProfilePosts(); } catch (e) { const el = $("feed-list"); if (el) el.innerHTML = '<p class="empty">' + escapeHtml(e.message) + "</p>"; } }
function renderStories() { const row = $("stories-row"); if (!row) return; const seen = new Map(); if (currentUser) seen.set(currentUser.id, { name: "Votre story", user: currentUser, mine: true }); feedPosts.forEach((p) => { const a = p.author || {}; if (a.id && !seen.has(a.id)) seen.set(a.id, { name: a.name || "Membre", user: a, mine: false }); }); if (!seen.size) { row.innerHTML = ""; return; } row.innerHTML = Array.from(seen.values()).slice(0, 8).map((s) => '<button type="button" class="story' + (s.mine ? " mine" : "") + '">' + avatarHtml(s.user, "story-avatar") + '<span>' + escapeHtml(s.name) + "</span></button>").join(""); }
function renderFeed() { const el = $("feed-list"); if (!el) return; const av = $("composer-avatar"); if (av) { av.innerHTML = currentUser ? initials(currentUser.name) : "N"; } renderStories(); if (!feedPosts.length) { el.innerHTML = '<p class="empty">Aucune publication pour le moment. Soyez la première personne à partager !</p>'; return; } el.innerHTML = feedPosts.map((p) => { const author = p.author || {}; const img = absoluteUrl(p.image_url); return '<article class="card">' + '<div class="post-head">' + avatarHtml(author) + '<div class="meta"><strong>' + escapeHtml(author.name || "Membre") + "</strong><br><span class='handle'>" + escapeHtml(author.handle || "@membre") + " · " + escapeHtml(timeAgo(p.created_at)) + "</span></div></div>" + (p.text ? '<p class="post-text">' + escapeHtml(p.text) + "</p>" : "") + (img ? '<img class="post-photo" src="' + escapeHtml(img) + '" alt="" loading="lazy" />' : "") + '<div class="post-actions"><button class="like-btn ' + (p.liked ? "liked" : "") + '" data-like="' + escapeHtml(p.id) + '">' + (p.liked ? "❤️" : "🤍") + " " + (p.likes || 0) + "</button><span class='counts'>0 commentaire · 0 partage</span></div></article>"; }).join(""); }
async function toggleLike(postId) { try { const data = await api("/api/posts/" + encodeURIComponent(postId) + "/like", { method: "POST", body: JSON.stringify({}) }); const post = feedPosts.find((p) => p.id === postId); if (post) { post.likes = data.likes; post.liked = data.liked; renderFeed(); renderProfilePosts(); } } catch (e) { toast(e.message); } }
async function publishPost() { const text = $("composer-text").value.trim(); const file = $("composer-photo").files[0]; showError($("feed-error"), ""); if (!text && !file) { showError($("feed-error"), "Ajoutez un texte ou une photo."); return; } try { const fd = new FormData(); fd.append("text", text); if (file) fd.append("photo", file); await api("/api/posts", { method: "POST", body: fd }); $("composer-text").value = ""; $("composer-photo").value = ""; $("composer-photo-name").textContent = ""; await loadFeed(); toast("Publication partagée !"); } catch (e) { showError($("feed-error"), e.message); } }

// --- Événements ---
async function loadEvents() { try { const data = await api("/api/events"); allEvents = data.events || []; renderEvents(); } catch (e) { const el = $("event-list"); if (el) el.innerHTML = '<p class="empty">' + escapeHtml(e.message) + "</p>"; } }
function eventMonth(date) { const m = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"]; const i = parseInt(String(date || "").slice(5, 7), 10); return i >= 1 && i <= 12 ? m[i - 1] : ""; }
function renderEvents() { const el = $("event-list"); if (!el) return; const today = todayISO(); const upcoming = eventFilter !== "passes"; const heading = $("event-heading"); if (heading) heading.textContent = upcoming ? "Événements à venir" : "Événements passés"; const list = allEvents.filter((ev) => upcoming ? (ev.date || "") >= today : (ev.date || "") < today); if (!list.length) { el.innerHTML = '<p class="empty">' + (upcoming ? "Aucun événement à venir." : "Aucun événement passé.") + "</p>"; return; } el.innerHTML = list.map((ev) => { const mine = currentUser && ev.user_id === currentUser.id; const day = String(ev.date || "").slice(8, 10).replace(/^0/, ""); return '<article class="card event-card"><div class="event-date"><span class="day">' + escapeHtml(day) + '</span><span class="month">' + escapeHtml(eventMonth(ev.date)) + "</span></div><div class='event-body'><h3>" + escapeHtml(ev.title) + "</h3><p class='event-meta'>" + escapeHtml(ev.date || "") + (ev.time ? " · " + escapeHtml(ev.time) : "") + "</p>" + (ev.location ? "<p class='event-meta'>📍 " + escapeHtml(ev.location) + "</p>" : "") + (ev.description ? '<p class="post-text">' + escapeHtml(ev.description) + "</p>" : "") + "<p class='event-meta'>Par " + escapeHtml(ev.author_name || "Membre") + "</p>" + (mine ? '<button class="delete-btn" data-del-event="' + escapeHtml(ev.id) + '">Supprimer</button>' : "") + "</div></article>"; }).join(""); }
async function createEvent() { const title = $("event-title").value.trim(); const date = $("event-date").value; const time = $("event-time").value.trim(); const location = $("event-location").value.trim(); const description = $("event-description").value.trim(); showError($("event-error"), ""); try { await api("/api/events", { method: "POST", body: JSON.stringify({ title, date, time, location, description }) }); ["event-title", "event-date", "event-time", "event-location", "event-description"].forEach((id) => { $(id).value = ""; }); hide($("event-form")); await loadEvents(); toast("Événement créé !"); } catch (e) { showError($("event-error"), e.message); } }
async function deleteEvent(id) { if (!confirm("Supprimer cet événement ?")) return; try { await api("/api/events/" + encodeURIComponent(id), { method: "DELETE" }); await loadEvents(); toast("Événement supprimé."); } catch (e) { toast(e.message); } }

// --- Messages ---
async function loadConversations() { try { const data = await api("/api/conversations"); conversations = data.conversations || []; renderConversations(); } catch (e) { const el = $("conv-list"); if (el) el.innerHTML = '<p class="empty">' + escapeHtml(e.message) + "</p>"; } }
function renderConversations() { const el = $("conv-list"); if (!el) return; const total = conversations.reduce((s, c) => s + (c.unread || 0), 0); const badge = $("total-unread-badge"); if (badge) { badge.textContent = String(total); badge.classList.toggle("hidden", total <= 0); } if (!conversations.length) { el.innerHTML = '<p class="empty">Aucune conversation. Recherchez un membre pour commencer.</p>'; return; } el.innerHTML = conversations.map((c) => { const o = c.other || {}; const t = timeAgo(c.last_at || c.lastAt || ""); return '<button class="conv-item" data-conv="' + escapeHtml(c.id) + '" data-conv-name="' + escapeHtml(o.name || "Membre") + '">' + avatarHtml(o) + '<span class="conv-main"><strong>' + escapeHtml(o.name || "Membre") + "</strong><br><span class='last'>" + escapeHtml(c.last_text || "") + "</span></span><span class='conv-meta'>" + (t ? '<span class="conv-time">' + escapeHtml(t) + "</span>" : "") + (c.unread ? '<span class="unread-badge">' + c.unread + "</span>" : "") + "</span></button>"; }).join(""); }
async function searchMembers(q) { const box = $("member-results"); if (!box) return; if (!q || q.trim().length < 2) { hide(box); return; } try { const data = await api("/api/users?q=" + encodeURIComponent(q.trim())); const users = data.users || []; if (!users.length) { box.innerHTML = '<p class="empty">Aucun membre trouvé.</p>'; show(box); return; } box.innerHTML = users.map((u) => '<div class="member-item" data-new-chat="' + escapeHtml(u.id) + '" data-new-chat-name="' + escapeHtml(u.name) + '">' + avatarHtml(u) + "<span><strong>" + escapeHtml(u.name) + "</strong><br><span class='handle'>" + escapeHtml(u.handle || "") + "</span></span></div>").join(""); show(box); } catch (e) { box.innerHTML = '<p class="empty">' + escapeHtml(e.message) + "</p>"; show(box); } }
async function startChat(userId, name) { try { const data = await api("/api/conversations", { method: "POST", body: JSON.stringify({ user_id: userId }) }); hide($("member-results")); $("member-search").value = ""; openChat(data.conversation.id, name); } catch (e) { toast(e.message); } }
function openChat(convId, name) { activeConv = { id: convId, otherName: name || "Discussion" }; $("chat-title").textContent = activeConv.otherName; show($("chat-view")); loadMessages(); }
function closeChat() { activeConv = null; hide($("chat-view")); loadConversations(); }
async function loadMessages() { if (!activeConv) return; try { const data = await api("/api/conversations/" + encodeURIComponent(activeConv.id) + "/messages"); const el = $("chat-messages"); if (!el) return; const msgs = data.messages || []; if (!msgs.length) { el.innerHTML = '<p class="empty">Aucun message. Dites bonjour !</p>'; return; } el.innerHTML = msgs.map((m) => '<div class="bubble ' + (m.from_self ? "me" : "other") + '">' + escapeHtml(m.text) + '<span class="time">' + escapeHtml(timeAgo(m.created_at)) + "</span></div>").join(""); el.scrollTop = el.scrollHeight; loadConversations(); } catch (e) { showError($("chat-error"), e.message); } }
async function sendMessage() { if (!activeConv) return; const input = $("chat-input"); const text = input.value.trim(); if (!text) return; showError($("chat-error"), ""); try { await api("/api/conversations/" + encodeURIComponent(activeConv.id) + "/messages", { method: "POST", body: JSON.stringify({ text }) }); input.value = ""; await loadMessages(); } catch (e) { showError($("chat-error"), e.message); } }

// --- Profil ---
function renderProfile() { if (!currentUser) return; const av = $("profile-avatar"); if (av) { const url = absoluteUrl(currentUser.photo_url); av.innerHTML = url ? '<img src="' + escapeHtml(url) + '" alt="" />' : initials(currentUser.name); } $("profile-name").textContent = currentUser.name || "—"; $("profile-handle").textContent = currentUser.handle || ""; const roleEl = $("profile-role"); if (roleEl) roleEl.textContent = currentUser.role || "Membre"; $("profile-email").textContent = currentUser.email || ""; $("profile-bio").textContent = currentUser.bio || "Aucune bio pour le moment."; const fol = $("profile-followers-count"); if (fol) fol.textContent = String(currentUser.followers ?? 0); const fing = $("profile-following-count"); if (fing) fing.textContent = String(currentUser.following ?? 0); renderProfilePosts(); }
function renderProfilePosts() { const mine = currentUser ? feedPosts.filter((p) => p.author && p.author.id === currentUser.id) : []; const el = $("profile-posts"); if (el) { if (!mine.length) { el.innerHTML = '<p class="empty">Aucune publication pour le moment.</p>'; } else { el.innerHTML = mine.map((p) => { const img = absoluteUrl(p.image_url); return '<article class="card">' + (p.text ? '<p class="post-text">' + escapeHtml(p.text) + "</p>" : "") + (img ? '<img class="post-photo" src="' + escapeHtml(img) + '" alt="" loading="lazy" />' : "") + "<p class='muted'>" + escapeHtml(timeAgo(p.created_at)) + " · ❤️ " + (p.likes || 0) + "</p></article>"; }).join(""); } } const grid = $("profile-photos"); if (grid) { const photos = mine.map((p) => absoluteUrl(p.image_url)).filter(Boolean); $("profile-posts-count").textContent = String(mine.length); $("profile-photos-count").textContent = String(photos.length); if (!photos.length) { grid.innerHTML = '<p class="empty">Aucune photo publiée.</p>'; } else { grid.innerHTML = photos.map((u) => '<img src="' + escapeHtml(u) + '" alt="" loading="lazy" />').join(""); } } }
async function saveBio() { const bio = $("bio-input").value; showError($("bio-error"), ""); try { const data = await api("/api/me", { method: "PUT", body: JSON.stringify({ bio: bio.slice(0, 300) }) }); currentUser = data.user; renderProfile(); hide($("bio-editor")); toast("Bio enregistrée !"); } catch (e) { showError($("bio-error"), e.message); } }
async function changeProfilePhoto(file) { if (!file) return; try { const fd = new FormData(); fd.append("photo", file); const data = await api("/api/me/photo", { method: "POST", body: fd }); currentUser = data.user; renderProfile(); toast("Photo de profil mise à jour !"); } catch (e) { showError($("profile-error"), e.message); } }

// --- Polling (5 s) ---
function startPolling() { stopPolling(); pollTimer = setInterval(async () => { if (!getToken()) return; await loadConversations(); if (activeConv) await loadMessages(); }, 5000); }
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

// --- Événements DOM ---
document.addEventListener("DOMContentLoaded", () => {
  // Navigation auth
  document.querySelectorAll("[data-nav]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); showAuthScreen(a.dataset.nav); }));
  $("btn-go-login").addEventListener("click", () => showAuthScreen("login"));
  $("btn-go-signup").addEventListener("click", () => showAuthScreen("signup"));
  $("btn-login").addEventListener("click", handleLogin);
  $("btn-signup").addEventListener("click", handleSignup);
  $("btn-setup-save").addEventListener("click", handleSetupSave);
  $("btn-setup-skip").addEventListener("click", () => afterAuth(true));
  $("login-password").addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });
  $("signup-password").addEventListener("keydown", (e) => { if (e.key === "Enter") handleSignup(); });

  // Feed
  $("btn-publish").addEventListener("click", publishPost);
  $("btn-refresh-feed").addEventListener("click", loadFeed);
  $("composer-photo").addEventListener("change", (e) => { const f = e.target.files[0]; $("composer-photo-name").textContent = f ? f.name : ""; });
  $("feed-list").addEventListener("click", (e) => { const btn = e.target.closest("[data-like]"); if (btn) toggleLike(btn.dataset.like); });
  $("profile-posts").addEventListener("click", (e) => { const btn = e.target.closest("[data-like]"); if (btn) toggleLike(btn.dataset.like); });

  // Bouton central : aller à l'Accueil et focus sur le compositeur.
  const central = $("btn-central-compose"); if (central) central.addEventListener("click", async () => { const tabs = document.querySelector("ion-tabs"); if (tabs && tabs.select) { try { await tabs.select("accueil"); } catch (e) { /* ion-tabs déjà sur Accueil */ } } const comp = $("composer-text"); if (comp) { comp.focus(); comp.scrollIntoView({ behavior: "smooth", block: "center" }); } });
  const showAll = $("btn-show-all-events"); if (showAll) showAll.addEventListener("click", () => { eventFilter = "avenir"; const seg = $("event-segment"); if (seg) seg.value = "avenir"; renderEvents(); const list = $("event-list"); if (list) list.scrollIntoView({ behavior: "smooth" }); });

  // Événements
  $("event-segment").addEventListener("ionChange", (e) => { eventFilter = e.detail.value; renderEvents(); });
  $("btn-open-event-form").addEventListener("click", () => show($("event-form")));
  $("btn-cancel-event").addEventListener("click", () => hide($("event-form")));
  $("btn-create-event").addEventListener("click", createEvent);
  $("event-list").addEventListener("click", (e) => { const btn = e.target.closest("[data-del-event]"); if (btn) deleteEvent(btn.dataset.delEvent); });

  // Messages
  $("member-search").addEventListener("ionInput", (e) => searchMembers(e.detail.value || ""));
  $("member-results").addEventListener("click", (e) => { const item = e.target.closest("[data-new-chat]"); if (item) startChat(item.dataset.newChat, item.dataset.newChatName); });
  $("conv-list").addEventListener("click", (e) => { const item = e.target.closest("[data-conv]"); if (item) openChat(item.dataset.conv, item.dataset.convName); });
  $("btn-new-chat").addEventListener("click", () => { $("member-search").focus(); toast("Recherchez un membre ci-dessus."); });
  $("btn-close-chat").addEventListener("click", closeChat);
  $("btn-send-chat").addEventListener("click", sendMessage);
  $("chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

  // Profil
  $("btn-logout").addEventListener("click", logout);
  $("btn-edit-bio").addEventListener("click", () => { $("bio-input").value = currentUser ? (currentUser.bio || "") : ""; show($("bio-editor")); });
  $("btn-cancel-bio").addEventListener("click", () => hide($("bio-editor")));
  $("btn-save-bio").addEventListener("click", saveBio);
  $("profile-photo-input").addEventListener("change", (e) => { changeProfilePhoto(e.target.files[0]); e.target.value = ""; });

  // Changement d'onglet : recharger la section
  document.querySelectorAll("ion-tab-button").forEach((b) => b.addEventListener("click", () => { const tab = b.getAttribute("tab"); if (tab === "accueil") loadFeed(); if (tab === "evenements") loadEvents(); if (tab === "messages") loadConversations(); if (tab === "profil") renderProfile(); }));

  // Démarrage : session existante ?
  (async () => { if (getToken()) { const me = await loadMe(); if (me) { await afterAuth(false); return; } } showAuth(); })();
});
