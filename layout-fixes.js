/* Layout preference layer: live match center first, next match lower. */
(() => {
  const app = document.querySelector("#app");
  if (!app) return;

  let applying = false;

  function textOf(node) {
    return String(node?.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function findCardByTitle(title) {
    return [...app.querySelectorAll(".card")].find((card) => {
      const h2 = card.querySelector("h2");
      return textOf(h2) === title;
    });
  }

  function prioritizeLiveMatchCenter() {
    const main = app.querySelector("main.wrap");
    const matchCenter = app.querySelector("#maclar");
    if (!main || !matchCenter) return;

    const notice = main.querySelector(".notice");
    const firstGrid = main.querySelector(".grid.cards-4");
    const targetBefore = firstGrid ?? main.firstElementChild;

    matchCenter.classList.add("live-priority");
    if (notice?.nextElementSibling !== matchCenter && targetBefore !== matchCenter) {
      main.insertBefore(matchCenter, notice ? notice.nextElementSibling : targetBefore);
    }

    const hasLive = Boolean(app.querySelector(".topbar-live, .chip.live"));
    const liveTab = matchCenter.querySelector("[data-filter='live']");
    if (hasLive && liveTab && !liveTab.classList.contains("active")) {
      liveTab.click();
    }
  }

  function moveNextMatchLower() {
    const main = app.querySelector("main.wrap");
    const nextCard = findCardByTitle("Sıradaki Maç");
    if (!main || !nextCard) return;

    nextCard.classList.add("next-match-lower");

    const mainGrid = main.querySelector(".grid.main-2");
    const follow = main.querySelector("#takip");
    const footer = main.querySelector(".site-footer");
    const anchor = follow ?? footer;

    if (mainGrid) {
      if (anchor && nextCard.nextElementSibling !== anchor) {
        main.insertBefore(nextCard, anchor);
      } else if (!anchor && mainGrid.nextElementSibling !== nextCard) {
        mainGrid.after(nextCard);
      }
    }
  }

  function applyLayout() {
    if (applying) return;
    applying = true;
    try {
      prioritizeLiveMatchCenter();
      moveNextMatchLower();
    } finally {
      applying = false;
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    #maclar.live-priority {
      margin-top: 18px;
      border-color: color-mix(in srgb, var(--live) 34%, var(--border));
      box-shadow: 0 18px 56px rgb(0 0 0 / 0.18);
    }

    #maclar.live-priority .card-head h2::before {
      background: var(--live);
      animation: pulse 1.5s ease-out infinite;
    }

    .next-match-lower {
      margin-top: 14px;
    }
  `;
  document.head.appendChild(style);

  applyLayout();
  const observer = new MutationObserver(() => requestAnimationFrame(applyLayout));
  observer.observe(app, { childList: true, subtree: true });
})();
