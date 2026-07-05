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

  function getGlobal(name) {
    try {
      return Function(`return typeof ${name} !== "undefined" ? ${name} : null`)();
    } catch {
      return null;
    }
  }

  function data() {
    return getGlobal("state")?.data ?? null;
  }

  function root() {
    return getGlobal("app") ?? document.querySelector("#app");
  }

  function esc(value) {
    const globalEscape = getGlobal("escapeHtml");
    if (typeof globalEscape === "function") {
      return globalEscape(value);
    }
    return String(value ?? "").replace(/[&<>\"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  function norm(value) {
    const globalNormalize = getGlobal("normalizeTeamName");
    if (typeof globalNormalize === "function") {
      return globalNormalize(value);
    }
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .toLowerCase();
  }

  function flag(team, cls = "flag") {
    const globalFlag = getGlobal("flagMarkup");
    if (typeof globalFlag === "function") {
      return globalFlag(team, cls);
    }
    return `<span class="${cls}">${esc(team?.abbr ?? "")}</span>`;
  }

  function stage(match) {
    const globalStage = getGlobal("stageLabel");
    if (typeof globalStage === "function") {
      return globalStage(match);
    }
    return match?.round ?? match?.group ?? "Maç";
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .s-row.scorer-clickable{margin-inline:-8px;padding-inline:8px;border-radius:10px;cursor:pointer;transition:background 140ms ease,box-shadow 140ms ease}
      .s-row.scorer-clickable:hover,.s-row.scorer-clickable[aria-expanded="true"]{background:var(--surface-2)}
      .s-row.scorer-clickable:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .s-row.scorer-clickable .g{display:inline-flex;align-items:center;gap:6px}
      .s-row.scorer-clickable .g::after{content:"›";color:var(--faint);font-family:var(--font);font-size:16px;line-height:1;transform:translateY(-1px)}
      .s-row.scorer-clickable[aria-expanded="true"] .g::after{content:"⌄";transform:translateY(-2px)}
      .scorer-details{margin:0 -8px 8px 34px;padding:10px 10px 11px;border:1px solid var(--border);border-radius:12px;background:color-mix(in srgb,var(--surface-2) 92%,transparent)}
      .scorer-details-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}
      .scorer-detail-list{display:grid;gap:7px}
      .scorer-detail-line{display:grid;grid-template-columns:44px minmax(0,1fr);gap:8px;align-items:start;font-size:12px}
      .scorer-detail-minute{font-family:var(--mono);font-weight:800;color:var(--accent)}
      .scorer-detail-match{min-width:0}.scorer-detail-teams{display:flex;align-items:center;gap:6px;min-width:0;font-weight:700}
      .scorer-detail-teams .flag{width:22px;height:16px;border-radius:3px}.scorer-detail-team-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .scorer-detail-score{flex:0 0 auto;font-family:var(--mono);color:var(--ink)}.scorer-detail-meta{margin-top:2px;color:var(--faint);font-size:11px}
      .scorer-detail-badge{display:inline-flex;margin-left:5px;padding:1px 5px;border-radius:999px;background:var(--accent-dim);color:var(--accent);font-size:10px;font-weight:800}
      .scorer-detail-empty{color:var(--muted);font-size:12px}
      @media(max-width:640px){.scorer-details{margin-left:0}.scorer-detail-line{grid-template-columns:38px minmax(0,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function cardTitle(card) {
    return String(card?.querySelector(":scope > .card-head h2")?.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scorerCards() {
    const r = root();
    return r ? [...r.querySelectorAll(".card")].filter((card) => cardTitle(card).includes("Gol Krallığı")) : [];
  }

  function isScorerRow(row) {
    return scorerCards().some((card) => card.contains(row));
  }

  function playerFromRow(row) {
    const nameBox = row.querySelector(".nm");
    if (!nameBox) return "";
    const smallText = String(nameBox.querySelector("small")?.textContent ?? "").trim();
    return String(nameBox.textContent ?? "").replace(smallText, "").replace(/\s+/g, " ").trim();
  }

  function teamFromRow(row) {
    return String(row.querySelector(".nm small")?.textContent ?? "").split("·")[0].trim();
  }

  function keyFor(player, team) {
    return `${norm(player)}|${norm(team)}`;
  }

  function similar(a, b) {
    const na = norm(a);
    const nb = norm(b);
    return Boolean(na && nb && (na === nb || na.includes(nb) || nb.includes(na)));
  }

  function goalRowsFor(player, teamName) {
    const payload = data();
    if (!payload?.allMatches?.length) return [];

    return payload.allMatches
      .flatMap((match) => (match.goalEvents ?? []).map((goal) => ({ match, goal })))
      .filter(({ goal }) => {
        if (!goal?.scorer || goal.isOwnGoal) return false;
        if (!similar(goal.scorer, player)) return false;
        return !teamName || similar(goal.team?.name, teamName);
      })
      .sort((a, b) => {
        const dateDiff = Date.parse(a.match.date) - Date.parse(b.match.date);
        return dateDiff || ((a.goal.clockValue ?? 0) - (b.goal.clockValue ?? 0));
      });
  }

  function score(match) {
    if (!match.isLive && !match.isFinished) return "vs";
    return `${match.homeGoals ?? "-"}–${match.awayGoals ?? "-"}`;
  }

  function detailHtml(player, teamName) {
    const goals = goalRowsFor(player, teamName);
    const title = `${esc(player)} · gol detayları`;

    if (goals.length === 0) {
      return `<div class="scorer-details" data-scorer-details>
        <div class="scorer-details-title"><span>${title}</span></div>
        <div class="scorer-detail-empty">Bu oyuncunun gol dakikası ESPN maç akışında henüz bulunamadı. Veri geldiğinde burada maç ve dakika listesi açılır.</div>
      </div>`;
    }

    return `<div class="scorer-details" data-scorer-details>
      <div class="scorer-details-title"><span>${title}</span><span>${goals.length} gol</span></div>
      <div class="scorer-detail-list">
        ${goals.map(({ match, goal }) => {
          const minute = goal.minute ?? (Number.isFinite(goal.clockValue) ? `${Math.floor(goal.clockValue / 60)}'` : "-");
          return `<div class="scorer-detail-line">
            <div class="scorer-detail-minute">${esc(minute)}</div>
            <div class="scorer-detail-match">
              <div class="scorer-detail-teams">
                ${flag(match.home)}<span class="scorer-detail-team-name">${esc(match.home.name)}</span>
                <span class="scorer-detail-score">${esc(score(match))}</span>
                ${flag(match.away)}<span class="scorer-detail-team-name">${esc(match.away.name)}</span>
              </div>
              <div class="scorer-detail-meta">${esc(stage(match))} · ${esc(detailDateFormatter.format(new Date(match.date)))}${match.venue ? ` · ${esc(match.venue)}` : ""}${goal.isPenalty ? '<span class="scorer-detail-badge">Penaltı</span>' : ""}${match.isLive ? '<span class="scorer-detail-badge">Canlı</span>' : ""}</div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }

  function closeDetails() {
    document.querySelectorAll("[data-scorer-details]").forEach((el) => el.remove());
    document.querySelectorAll(".s-row.scorer-clickable[aria-expanded='true']").forEach((row) => row.setAttribute("aria-expanded", "false"));
  }

  function toggle(row) {
    if (!isScorerRow(row)) return;
    const player = playerFromRow(row);
    const team = teamFromRow(row);
    const rowKey = keyFor(player, team);
    const wasOpen = row.getAttribute("aria-expanded") === "true";

    closeDetails();
    if (wasOpen) {
      openScorerKey = null;
      return;
    }

    openScorerKey = rowKey;
    row.setAttribute("aria-expanded", "true");
    row.insertAdjacentHTML("afterend", detailHtml(player, team));
  }

  function enhance() {
    injectStyles();
    for (const card of scorerCards()) {
      const note = card.querySelector(":scope > .card-head .card-note");
      if (note && !note.dataset.scorerHint) {
        note.dataset.scorerHint = "1";
        note.textContent = `${note.textContent.trim()} · tıkla`;
      }

      card.querySelectorAll(":scope .list-pad > .s-row").forEach((row) => {
        const player = playerFromRow(row);
        const team = teamFromRow(row);
        const rowKey = keyFor(player, team);
        row.classList.add("scorer-clickable");
        row.dataset.scorerKey = rowKey;
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.setAttribute("aria-expanded", "false");
        row.setAttribute("aria-label", `${player} gol detaylarını göster`);
        row.title = `${player} gol detaylarını göster`;

        if (openScorerKey && rowKey === openScorerKey && !row.nextElementSibling?.matches("[data-scorer-details]")) {
          row.setAttribute("aria-expanded", "true");
          row.insertAdjacentHTML("afterend", detailHtml(player, team));
        }
      });
    }
  }

  function scheduleEnhance() {
    if (enhanceScheduled) return;
    enhanceScheduled = true;
    requestAnimationFrame(() => {
      enhanceScheduled = false;
      enhance();
    });
  }

  document.addEventListener("click", (event) => {
    const row = event.target.closest(".s-row.scorer-clickable");
    if (row && isScorerRow(row)) toggle(row);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest?.(".s-row.scorer-clickable");
    if (!row || !isScorerRow(row)) return;
    event.preventDefault();
    toggle(row);
  });

  document.addEventListener("DOMContentLoaded", scheduleEnhance);
  window.addEventListener("load", scheduleEnhance);
  setInterval(scheduleEnhance, 1200);

  const observerRoot = root();
  if (observerRoot) {
    new MutationObserver(scheduleEnhance).observe(observerRoot, { childList: true, subtree: true });
  }
})();
