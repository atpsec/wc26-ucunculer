/* Responsive polish layer. Keeps the original section order intact. */
(() => {
  const app = document.querySelector("#app");
  if (!app) return;

  let applying = false;

  function textOf(node) {
    return String(node?.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function findMatchCard() {
    return [...app.querySelectorAll(".card")].find((card) => {
      const title = textOf(card.querySelector("h2"));
      return title === "Sıradaki Maç" || title === "Canlı Maç";
    });
  }

  function findLiveMatchItem() {
    return app.querySelector("#maclar .m-item.live-m");
  }

  function cloneFlag(teamLine) {
    return teamLine?.querySelector(".flag")?.cloneNode(true) ?? document.createElement("span");
  }

  function teamName(teamLine) {
    return textOf(teamLine?.querySelector(".nm")) || "Takım";
  }

  function teamScore(teamLine) {
    return textOf(teamLine?.querySelector(".g")) || "-";
  }

  function setLiveCard(card, liveItem) {
    const lines = [...liveItem.querySelectorAll(".m-line")];
    const home = lines[0];
    const away = lines[1];
    if (!home || !away) return;

    const minute = textOf(liveItem.querySelector(".m-when .big")) || "CANLI";
    const stage = textOf(liveItem.querySelector(".m-tag"));
    const goals = liveItem.querySelector(".m-goals")?.cloneNode(true);

    const headTitle = card.querySelector("h2");
    const note = card.querySelector(".card-note");
    if (headTitle) headTitle.textContent = "Canlı Maç";
    if (note) note.innerHTML = `<span class="live-txt">${minute}</span>`;

    const body = card.querySelector(".next-body");
    if (!body) return;

    body.innerHTML = `
      <div class="live-card-badge"><span class="live-dot"></span> CANLI</div>
      <div class="next-line live-card-line">
        <div class="next-team">${cloneFlag(home).outerHTML}<span>${teamName(home)}</span></div>
        <span class="live-score">${teamScore(home)}–${teamScore(away)}</span>
        <div class="next-team">${cloneFlag(away).outerHTML}<span>${teamName(away)}</span></div>
      </div>
      <div class="next-sub">${stage}</div>
      ${goals ? goals.outerHTML : ""}
    `;
    card.classList.add("live-match-card");
  }

  function enhance() {
    if (applying) return;
    applying = true;
    try {
      document.body.classList.add("wc26-polished");
      const card = findMatchCard();
      const liveItem = findLiveMatchItem();
      if (card && liveItem) setLiveCard(card, liveItem);
      app.querySelectorAll("#maclar .m-item").forEach((item) => {
        item.classList.add("fixture-card");
        item.classList.toggle("fixture-live-card", item.classList.contains("live-m"));
      });
    } finally {
      applying = false;
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .wc26-polished .wrap { width: min(1380px, 100% - 36px); }
    .wc26-polished .card { box-shadow: 0 12px 36px rgb(0 0 0 / 0.06); }
    .wc26-polished .grid.cards-4 { grid-template-columns: minmax(260px,1.08fr) minmax(260px,.92fr) minmax(280px,.9fr) minmax(240px,.72fr); align-items: stretch; }
    .wc26-polished .grid.main-2 { grid-template-columns: minmax(0,1.55fr) minmax(340px,.72fr); gap: 18px; }
    .live-match-card { border-color: color-mix(in srgb, var(--live) 42%, var(--border)); box-shadow: 0 18px 54px rgb(255 78 69 / 0.08); }
    .live-match-card .card-head h2::before { background: var(--live); animation: pulse 1.5s ease-out infinite; }
    .live-card-badge { display:inline-flex; align-items:center; gap:8px; align-self:center; margin-bottom:12px; padding:6px 10px; border-radius:999px; background:var(--live-dim); color:var(--live); font-size:12px; font-weight:800; }
    .live-card-line { align-items:center; gap:12px; }
    .live-score { min-width:96px; text-align:center; color:var(--ink); font-family:var(--mono); font-size:clamp(31px,4vw,46px); font-weight:800; letter-spacing:-0.06em; line-height:1; }
    .live-match-card .m-goals { margin-top:14px; padding-top:12px; border-top:1px solid var(--border); display:grid; gap:6px; color:var(--muted); font-size:12px; }
    .wc26-polished #yol { min-width:0; }
    .wc26-polished #yol .bracket { min-height:560px; overflow-x:auto; overflow-y:hidden; scroll-snap-type:x proximity; padding-bottom:12px; }
    .wc26-polished #yol .round-col { min-width:238px; scroll-snap-align:start; }
    .wc26-polished #yol .tie { border-radius:12px; box-shadow:0 8px 20px rgb(0 0 0 / 0.04); }
    .wc26-polished #maclar { position:sticky; top:70px; max-height:calc(100dvh - 88px); display:flex; flex-direction:column; }
    .wc26-polished #maclar .match-list { overflow:auto; padding:0 12px 12px; }
    .wc26-polished #maclar .fixture-card { display:grid; grid-template-columns:52px minmax(0,1fr) auto; align-items:center; gap:12px; margin-top:10px; border:1px solid var(--border); border-radius:14px; background:var(--surface); overflow:hidden; }
    .wc26-polished #maclar .fixture-live-card { grid-template-columns:1fr; padding:14px; border-color:color-mix(in srgb, var(--live) 55%, var(--border)); }
    .wc26-polished #maclar .fixture-live-card .m-when { justify-self:center; width:auto; min-width:72px; padding:5px 12px; border-radius:999px; background:var(--live); color:#fff; font-weight:800; }
    .wc26-polished #maclar .fixture-live-card .m-teams { width:100%; display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .wc26-polished #maclar .fixture-live-card .m-line { display:grid; justify-items:center; gap:7px; padding:10px; border-radius:12px; background:var(--surface-2); }
    .wc26-polished #maclar .fixture-live-card .m-line .g { font-family:var(--mono); font-size:30px; line-height:1; color:var(--ink); }
    .wc26-polished #maclar .fixture-live-card .m-tag { justify-self:center; text-align:center; color:var(--muted); }
    @media (max-width:1180px){ .wc26-polished .grid.cards-4{grid-template-columns:repeat(2,minmax(0,1fr));} .wc26-polished .grid.main-2{grid-template-columns:1fr;} .wc26-polished #maclar{position:static;max-height:none;} }
    @media (max-width:720px){ .wc26-polished .wrap{width:min(100% - 22px,1380px);} .wc26-polished .grid.cards-4{grid-template-columns:1fr;} .wc26-polished #yol .bracket{min-height:0;display:flex;gap:12px;padding:12px;} .wc26-polished #yol .round-col{min-width:min(82vw,320px);border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface-2);} .wc26-polished #maclar .fixture-card{grid-template-columns:46px minmax(0,1fr);} .wc26-polished #maclar .fixture-card .m-tag{grid-column:1/-1;padding:0 12px 10px;} }
  `;
  document.head.appendChild(style);

  enhance();
  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(app, { childList: true, subtree: true });
})();
