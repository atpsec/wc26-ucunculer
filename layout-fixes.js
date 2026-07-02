/* Keep the original grid layout. If there is a live match, reuse the Sıradaki Maç card slot as Canlı Maç. */
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

    const homeFlag = cloneFlag(home).outerHTML;
    const awayFlag = cloneFlag(away).outerHTML;

    body.innerHTML = `
      <div class="live-card-badge"><span class="live-dot"></span> CANLI</div>
      <div class="next-line live-card-line">
        <div class="next-team">${homeFlag}<span>${teamName(home)}</span></div>
        <span class="live-score">${teamScore(home)}–${teamScore(away)}</span>
        <div class="next-team">${awayFlag}<span>${teamName(away)}</span></div>
      </div>
      <div class="next-sub">${stage}</div>
      ${goals ? goals.outerHTML : ""}
    `;
    card.classList.add("live-match-card");
  }

  function applyLiveCard() {
    if (applying) return;
    applying = true;
    try {
      const card = findMatchCard();
      const liveItem = findLiveMatchItem();
      if (card && liveItem) {
        setLiveCard(card, liveItem);
      }
    } finally {
      applying = false;
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .live-match-card {
      border-color: color-mix(in srgb, var(--live) 42%, var(--border));
      box-shadow: 0 18px 54px rgb(255 78 69 / 0.08);
    }

    .live-match-card .card-head h2::before {
      background: var(--live);
      animation: pulse 1.5s ease-out infinite;
    }

    .live-card-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      align-self: center;
      margin-bottom: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--live-dim);
      color: var(--live);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.03em;
    }

    .live-card-line {
      align-items: center;
    }

    .live-score {
      min-width: 86px;
      text-align: center;
      color: var(--live);
      font-family: var(--mono);
      font-size: clamp(28px, 4vw, 42px);
      font-weight: 800;
      letter-spacing: -0.06em;
      line-height: 1;
    }

    .live-match-card .m-goals {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);

  applyLiveCard();
  const observer = new MutationObserver(() => requestAnimationFrame(applyLiveCard));
  observer.observe(app, { childList: true, subtree: true });
})();
