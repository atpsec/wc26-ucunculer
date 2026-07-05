/* Gol krallığı satırlarına maç/dakika detayları ekler. */
(() => {
  const STYLE_ID = "scorer-goal-details-style";
  let openScorerKey = null;
  let enhanceScheduled = false;

  const detailDateFormatter = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  function safeEscape(value) {
    if (typeof escapeHtml === "function") {
      return escapeHtml(value);
    }
    return String(value ?? "").replace(/[&<>\"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  function safeNormalize(value) {
    if (typeof normalizeTeamName === "function") {
      return normalizeTeamName(value);
    }
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .toLowerCase();
  }

  function getData() {
    try {
      return state?.data ?? null;
    } catch {
      return null;
    }
  }

  function getAppElement() {
    try {
      return app ?? document.querySelector("#app");
    } catch {
      return document.querySelector("#app");
    }
  }

  function safeFlagMarkup(team, cls = "flag") {
    if (typeof flagMarkup === "function") {
      return flagMarkup(team, cls);
    }
    return `<span class="${cls}">${safeEscape(team?.abbr ?? "")}</span>`;
  }

  function safeStageLabel(match) {
    if (typeof stageLabel === "function") {
      return stageLabel(match);
    }
    return match?.round ?? match?.group ?? "Maç";
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .s-row.scorer-clickable {
        margin-inline: -8px;
        padding-inline: 8px;
        border-radius: 10px;
        cursor: pointer;
        transition: background 140ms ease, border-color 140ms ease;
      }

      .s-row.scorer-clickable:hover,
      .s-row.scorer-clickable[aria-expanded="true"] {
        background: var(--surface-2);
      }

      .s-row.scorer-clickable:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .s-row.scorer-clickable .g {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .s-row.scorer-clickable .g::after {
        content: "›";
        color: var(--faint);
        font-family: var(--font);
        font-size: 16px;
        line-height: 1;
        transform: translateY(-1px);
      }

      .s-row.scorer-clickable[aria-expanded="true"] .g::after {
        content: "⌄";
        transform: translateY(-2px);
      }

      .scorer-details {
        margin: 0 -8px 8px 34px;
        padding: 10px 10px 11px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: color-mix(in srgb, var(--surface-2) 92%, transparent);
      }

      .scorer-details-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--faint);
      }

      .scorer-detail-list {
        display: grid;
        gap: 7px;
      }

      .scorer-detail-line {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        font-size: 12px;
      }

      .scorer-detail-minute {
        font-family: var(--mono);
        font-weight: 800;
        color: var(--accent);
      }

      .scorer-detail-match {
        min-width: 0;
      }

      .scorer-detail-teams {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        font-weight: 700;
      }

      .scorer-detail-teams .flag {
        width: 22px;
        height: 16px;
        border-radius: 3px;
      }

      .scorer-detail-team-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .scorer-detail-score {
        flex: 0 0 auto;
        font-family: var(--mono);
        color: var(--ink);
      }

      .scorer-detail-meta {
        margin-top: 2px;
        color: var(--faint);
        font-size: 11px;
      }

      .scorer-detail-badge {
        display: inline-flex;
        margin-left: 5px;
        padding: 1px 5px;
        border-radius: 999px;
        background: var(--accent-dim);
        color: var(--accent);
        font-size: 10px;
        font-weight: 800;
      }

      .scorer-detail-empty {
        color: var(--muted);
        font-size: 12px;
      }

      @media (max-width: 640px) {
        .scorer-details {
          margin-left: 0;
        }

        .scorer-detail-line {
          grid-template-columns: 38px minmax(0, 1fr);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function scorerNameFromRow(row) {
    const nameElement = row.querySelector(".nm");
    if (!nameElement) {
      return "";
    }

    const directText = [...nameElement.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.nodeValue)
      .join(" ")
      .trim();

    return directText || nameElement.textContent.replace(nameElement.querySelector("small")?.textContent ?? "", "").trim();
  }

  function scorerTeamFromRow(row) {
    const small = row.querySelector(".nm small");
    return (small?.textContent ?? "").split("·")[0].trim();
  }

  function scorerKey(playerName, teamName) {
    return `${safeNormalize(playerName)}|${safeNormalize(teamName)}`;
  }

  function goalTeamMatches(goal, teamName) {
    const expected = safeNormalize(teamName);
    if (!expected) {
      return true;
    }

    const actual = safeNormalize(goal.team?.name ?? "");
    return actual === expected || actual.includes(expected) || expected.includes(actual);
  }

  function goalsForScorer(playerName, teamName) {
    const data = getData();
    if (!data?.allMatches?.length) {
      return [];
    }

    const normalizedPlayer = safeNormalize(playerName);

    return data.allMatches
      .flatMap((match) =>
        (match.goalEvents ?? []).map((goal) => ({
          match,
          goal,
        }))
      )
      .filter(({ goal }) => {
        if (!goal?.scorer || goal.isOwnGoal) {
          return false;
        }
        return safeNormalize(goal.scorer) === normalizedPlayer && goalTeamMatches(goal, teamName);
      })
      .sort((first, second) => {
        const dateDiff = Date.parse(first.match.date) - Date.parse(second.match.date);
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return (first.goal.clockValue ?? 0) - (second.goal.clockValue ?? 0);
      });
  }

  function scoreText(match) {
    const started = match.isLive || match.isFinished;
    if (!started) {
      return "vs";
    }
    return `${match.homeGoals ?? "-"}–${match.awayGoals ?? "-"}`;
  }

  function renderGoalDetails(playerName, teamName) {
    const goals = goalsForScorer(playerName, teamName);
    const title = `${safeEscape(playerName)} · gol detayları`;

    if (goals.length === 0) {
      return `<div class="scorer-details" data-scorer-details>
        <div class="scorer-details-title"><span>${title}</span></div>
        <div class="scorer-detail-empty">Bu oyuncu için maç/dakika detayı canlı maç verisinde henüz yok.</div>
      </div>`;
    }

    const lines = goals
      .map(({ match, goal }) => {
        const minute = goal.minute ?? (goal.clockValue !== null ? `${Math.floor(goal.clockValue / 60)}'` : "-");
        const badges = `${goal.isPenalty ? '<span class="scorer-detail-badge">Penaltı</span>' : ""}${
          match.isLive ? '<span class="scorer-detail-badge">Canlı</span>' : ""
        }`;
        return `<div class="scorer-detail-line">
          <div class="scorer-detail-minute">${safeEscape(minute)}</div>
          <div class="scorer-detail-match">
            <div class="scorer-detail-teams">
              ${safeFlagMarkup(match.home)}
              <span class="scorer-detail-team-name">${safeEscape(match.home.name)}</span>
              <span class="scorer-detail-score">${safeEscape(scoreText(match))}</span>
              ${safeFlagMarkup(match.away)}
              <span class="scorer-detail-team-name">${safeEscape(match.away.name)}</span>
            </div>
            <div class="scorer-detail-meta">${safeEscape(safeStageLabel(match))} · ${safeEscape(
              detailDateFormatter.format(new Date(match.date))
            )}${match.venue ? ` · ${safeEscape(match.venue)}` : ""}${badges}</div>
          </div>
        </div>`;
      })
      .join("");

    return `<div class="scorer-details" data-scorer-details>
      <div class="scorer-details-title"><span>${title}</span><span>${goals.length} gol</span></div>
      <div class="scorer-detail-list">${lines}</div>
    </div>`;
  }

  function closeOpenDetails() {
    document.querySelectorAll("[data-scorer-details]").forEach((element) => element.remove());
    document.querySelectorAll(".s-row.scorer-clickable[aria-expanded='true']").forEach((row) => {
      row.setAttribute("aria-expanded", "false");
    });
  }

  function openDetailsForRow(row) {
    const playerName = scorerNameFromRow(row);
    const teamName = scorerTeamFromRow(row);
    const key = scorerKey(playerName, teamName);
    const isAlreadyOpen = row.getAttribute("aria-expanded") === "true";

    closeOpenDetails();

    if (isAlreadyOpen) {
      openScorerKey = null;
      return;
    }

    openScorerKey = key;
    row.setAttribute("aria-expanded", "true");
    row.insertAdjacentHTML("afterend", renderGoalDetails(playerName, teamName));
  }

  function isScorerRow(row) {
    const card = row.closest(".card");
    const heading = card?.querySelector(".card-head h2")?.textContent?.trim();
    return heading === "Gol Krallığı";
  }

  function enhanceScorers() {
    injectStyles();

    const root = getAppElement();
    if (!root) {
      return;
    }

    root.querySelectorAll(".s-row").forEach((row) => {
      if (!isScorerRow(row)) {
        return;
      }

      const playerName = scorerNameFromRow(row);
      const teamName = scorerTeamFromRow(row);
      const key = scorerKey(playerName, teamName);

      row.classList.add("scorer-clickable");
      row.dataset.scorerKey = key;
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.setAttribute("aria-expanded", row.getAttribute("aria-expanded") ?? "false");
      row.setAttribute(
        "aria-label",
        `${playerName} gol detaylarını göster: maçlar ve dakikalar`
      );
      row.title = `${playerName} gol detaylarını göster`;

      if (row.dataset.scorerEnhanced !== "1") {
        row.dataset.scorerEnhanced = "1";
        row.addEventListener("click", () => openDetailsForRow(row));
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDetailsForRow(row);
          }
        });
      }

      if (openScorerKey && key === openScorerKey && row.nextElementSibling?.dataset.scorerDetails !== "") {
        closeOpenDetails();
        row.setAttribute("aria-expanded", "true");
        row.insertAdjacentHTML("afterend", renderGoalDetails(playerName, teamName));
      }
    });
  }

  function scheduleEnhance() {
    if (enhanceScheduled) {
      return;
    }
    enhanceScheduled = true;
    requestAnimationFrame(() => {
      enhanceScheduled = false;
      enhanceScorers();
    });
  }

  document.addEventListener("DOMContentLoaded", scheduleEnhance);
  window.addEventListener("load", scheduleEnhance);
  setInterval(scheduleEnhance, 1500);

  const root = getAppElement();
  if (root) {
    new MutationObserver(scheduleEnhance).observe(root, {
      childList: true,
      subtree: true,
    });
  }
})();
