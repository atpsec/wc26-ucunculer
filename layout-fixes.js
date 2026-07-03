(() => {
  const app = document.querySelector("#app");
  if (!app) return;

  let applying = false;
  const base = [
    ["Miroslav Klose", "Almanya", 16],
    ["Ronaldo", "Brezilya", 15],
    ["Gerd Müller", "Almanya", 14],
    ["Just Fontaine", "Fransa", 13],
    ["Lionel Messi", "Arjantin", 13],
    ["Kylian Mbappé", "Fransa", 12],
    ["Pelé", "Brezilya", 12],
    ["Sándor Kocsis", "Macaristan", 11],
    ["Jürgen Klinsmann", "Almanya", 11],
    ["Harry Kane", "İngiltere", 8],
    ["Cristiano Ronaldo", "Portekiz", 8]
  ];

  function txt(n) { return String(n?.textContent ?? "").replace(/\s+/g, " ").trim(); }
  function norm(v) { return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  function directCardsGrid() { return app.querySelector("main.wrap > .grid.cards-4"); }
  function directCards() { const grid = directCardsGrid(); return grid ? [...grid.children].filter((el) => el.classList?.contains("card")) : []; }
  function cardTitle(card) { return txt(card.querySelector(":scope > .card-head h2")); }

  function currentGoals() {
    const scorers = directCards().find((card) => cardTitle(card) === "Gol Krallığı");
    const map = new Map();
    if (!scorers) return map;
    scorers.querySelectorAll(":scope > .list-pad > .s-row").forEach((row) => {
      const nameNode = row.querySelector(".nm");
      const small = txt(nameNode?.querySelector("small"));
      const name = txt(nameNode).replace(small, "").trim();
      const goals = Number(txt(row.querySelector(".g")).replace(/[^0-9]/g, ""));
      if (name && Number.isFinite(goals)) map.set(norm(name), goals);
    });
    return map;
  }

  function rows() {
    const live = currentGoals();
    return base.map(([player, country, oldGoals]) => {
      const add = live.get(norm(player)) ?? 0;
      return { player, country, oldGoals, add, total: oldGoals + add };
    }).sort((a, b) => b.total - a.total || b.add - a.add || a.player.localeCompare(b.player, "tr-TR")).slice(0, 5);
  }

  function allTimeMarkup() {
    return `<article class="card all-time-card">
      <div class="card-head"><h2>DK Tüm Zamanlar</h2><span class="card-note">2026 dahil</span></div>
      <div class="list-pad all-time-card-body">
        ${rows().map((r, i) => `<div class="s-row all-time-row">
          <span class="rk">${i + 1}</span><span class="all-time-medal">★</span>
          <span class="nm">${r.player}<small>${r.country}${r.add ? ` · 2026: +${r.add}` : ""}</small></span>
          <span class="g">${r.total}</span>
        </div>`).join("")}
      </div>
    </article>`;
  }

  function cloneFlag(teamLine) { return teamLine?.querySelector(".flag")?.cloneNode(true) ?? document.createElement("span"); }
  function setLiveCard() {
    const matchCard = directCards().find((card) => ["Sıradaki Maç", "Canlı Maç"].includes(cardTitle(card)));
    const liveItem = app.querySelector("#maclar .m-item.live-m");
    if (!matchCard || !liveItem) return;
    const lines = [...liveItem.querySelectorAll(".m-line")];
    const home = lines[0]; const away = lines[1];
    const body = matchCard.querySelector(".next-body");
    if (!home || !away || !body) return;
    const title = matchCard.querySelector(":scope > .card-head h2");
    const note = matchCard.querySelector(":scope > .card-head .card-note");
    if (title) title.textContent = "Canlı Maç";
    if (note) note.innerHTML = `<span class="live-txt">${txt(liveItem.querySelector(".m-when .big")) || "CANLI"}</span>`;
    body.innerHTML = `<div class="live-card-badge"><span class="live-dot"></span> CANLI</div>
      <div class="next-line live-card-line">
        <div class="next-team">${cloneFlag(home).outerHTML}<span>${txt(home.querySelector(".nm"))}</span></div>
        <span class="live-score">${txt(home.querySelector(".g")) || "-"}–${txt(away.querySelector(".g")) || "-"}</span>
        <div class="next-team">${cloneFlag(away).outerHTML}<span>${txt(away.querySelector(".nm"))}</span></div>
      </div>
      <div class="next-sub">${txt(liveItem.querySelector(".m-tag"))}</div>
      ${liveItem.querySelector(".m-goals")?.outerHTML ?? ""}`;
    matchCard.classList.add("live-match-card");
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      document.body.classList.add("wc26-polished");
      const grid = directCardsGrid();
      if (!grid) return;
      app.querySelectorAll(".all-time-scorers").forEach((n) => n.remove());
      grid.querySelectorAll(":scope > .all-time-card").forEach((n) => n.remove());
      const scorers = directCards().find((card) => cardTitle(card) === "Gol Krallığı");
      if (scorers) scorers.insertAdjacentHTML("afterend", allTimeMarkup());
      setLiveCard();
      app.querySelectorAll("#maclar .m-item").forEach((item) => item.classList.add("fixture-card"));
    } finally { applying = false; }
  }

  const style = document.createElement("style");
  style.textContent = `
    .wc26-polished .wrap{width:min(1500px,100% - 36px)}
    .wc26-polished .grid.cards-4{grid-template-columns:1.08fr .88fr .82fr .88fr .72fr;align-items:stretch}
    .wc26-polished .card{box-shadow:0 12px 36px rgb(0 0 0/.06)}
    .all-time-card .card-head h2::before{background:#d6a21a}.all-time-medal{width:28px;text-align:center;color:#d6a21a}.all-time-row{border-radius:10px;background:color-mix(in srgb,var(--surface-2) 72%,transparent)}.all-time-card .s-row{min-height:50px}.all-time-card .nm{font-size:13px}.all-time-card .g{color:var(--accent);font-size:18px}
    .live-match-card{border-color:color-mix(in srgb,var(--live) 42%,var(--border));box-shadow:0 18px 54px rgb(255 78 69/.08)}.live-match-card .card-head h2::before{background:var(--live);animation:pulse 1.5s ease-out infinite}.live-card-badge{display:inline-flex;align-items:center;gap:8px;align-self:center;margin-bottom:12px;padding:6px 10px;border-radius:999px;background:var(--live-dim);color:var(--live);font-size:12px;font-weight:800}.live-card-line{align-items:center;gap:12px}.live-score{min-width:82px;text-align:center;color:var(--ink);font-family:var(--mono);font-size:clamp(28px,3.3vw,42px);font-weight:800;letter-spacing:-.06em;line-height:1}.live-match-card .m-goals{margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:grid;gap:6px;color:var(--muted);font-size:12px}
    @media(max-width:1320px){.wc26-polished .grid.cards-4{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:980px){.wc26-polished .grid.cards-4{grid-template-columns:repeat(2,minmax(0,1fr))}.wc26-polished .grid.main-2{grid-template-columns:1fr}.wc26-polished #maclar{position:static;max-height:none}}
    @media(max-width:720px){.wc26-polished .wrap{width:min(100% - 22px,1500px)}.wc26-polished .grid.cards-4{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  apply();
  new MutationObserver(() => requestAnimationFrame(apply)).observe(app,{childList:true,subtree:true});
})();
