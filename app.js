/* ============================================================
   Dünya Kupası Yol Haritası ’26 — spor uygulaması koyu tema
   Veri: ESPN public API — 10 saniyede bir otomatik yenilenir
   ============================================================ */

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const ESPN_KNOCKOUT_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260627-20260720&limit=300";
const ESPN_STATS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/statistics";
const ESPN_TOURNAMENT_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300";
const ESPN_STANDINGS_URL =
  "https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";

const GROUP_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const REFRESH_SECONDS = 10;
const TOURNAMENT_START = "2026-06-11";
const TOURNAMENT_END = "2026-07-19";
const FOLLOW_STORAGE_KEY = "wc26-followed-team";

const TEAM_FLAG_CODES = {
  algeria: "dz",
  argentina: "ar",
  australia: "au",
  austria: "at",
  belgium: "be",
  "bosnia and herzegovina": "ba",
  "bosnia herzegovina": "ba",
  brazil: "br",
  canada: "ca",
  cameroon: "cm",
  "cabo verde": "cv",
  "cape verde": "cv",
  chile: "cl",
  colombia: "co",
  "costa rica": "cr",
  croatia: "hr",
  curacao: "cw",
  czechia: "cz",
  "czech republic": "cz",
  denmark: "dk",
  "dr congo": "cd",
  "democratic republic of congo": "cd",
  "congo dr": "cd",
  ecuador: "ec",
  egypt: "eg",
  england: "gb-eng",
  france: "fr",
  germany: "de",
  ghana: "gh",
  haiti: "ht",
  honduras: "hn",
  iran: "ir",
  "ir iran": "ir",
  italy: "it",
  ivory: "ci",
  "ivory coast": "ci",
  "cote d ivoire": "ci",
  jamaica: "jm",
  japan: "jp",
  "korea republic": "kr",
  "republic of korea": "kr",
  "south korea": "kr",
  mexico: "mx",
  morocco: "ma",
  netherlands: "nl",
  "new zealand": "nz",
  nigeria: "ng",
  "northern ireland": "gb-nir",
  norway: "no",
  panama: "pa",
  paraguay: "py",
  peru: "pe",
  poland: "pl",
  portugal: "pt",
  qatar: "qa",
  romania: "ro",
  russia: "ru",
  "saudi arabia": "sa",
  scotland: "gb-sct",
  senegal: "sn",
  serbia: "rs",
  slovakia: "sk",
  slovenia: "si",
  "south africa": "za",
  spain: "es",
  sweden: "se",
  switzerland: "ch",
  tunisia: "tn",
  turkey: "tr",
  turkiye: "tr",
  ukraine: "ua",
  uruguay: "uy",
  usa: "us",
  "united states": "us",
  "united states of america": "us",
  uzbekistan: "uz",
  wales: "gb-wls",
};

const ROUND_ORDER = [
  { key: "r32", label: "Son 32" },
  { key: "r16", label: "Son 16" },
  { key: "qf", label: "Çeyrek Final" },
  { key: "sf", label: "Yarı Final" },
  { key: "final", label: "Final" },
];

const state = {
  data: null,
  loading: true,
  refreshing: false,
  error: null,
  matchFilter: "today",
  matchQuery: "",
  followedTeam: null,
  timelineScrolled: false,
};

try {
  state.followedTeam = window.localStorage.getItem(FOLLOW_STORAGE_KEY) || null;
} catch {
  /* storage kapalıysa takip özelliği oturumla sınırlı kalır */
}

let previousScores = new Map();

const app = document.querySelector("#app");
const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});
const weekdayFormatter = new Intl.DateTimeFormat("tr-TR", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long" });

/* ============================================================
   Yardımcılar
   ============================================================ */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
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

function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function getFlagCode(teamName) {
  const normalized = normalizeTeamName(teamName);
  if (TEAM_FLAG_CODES[normalized]) {
    return TEAM_FLAG_CODES[normalized];
  }
  const partial = Object.entries(TEAM_FLAG_CODES).find(([name]) =>
    normalized.includes(name)
  );
  return partial?.[1] ?? null;
}

function getFlagUrl(flagCode) {
  return flagCode ? `https://flagcdn.com/w80/${flagCode.toLowerCase()}.png` : null;
}

function teamInitials(name) {
  return String(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function withTeamVisuals(team) {
  const name = String(team?.name ?? "").trim() || "Bilinmeyen takım";
  const flagCode = getFlagCode(name);
  return {
    id: team?.id,
    name,
    abbr: team?.abbr ?? null,
    logo: team?.logo ?? null,
    flagCode,
    flagUrl: getFlagUrl(flagCode),
  };
}

function teamShort(team) {
  return team.abbr ?? teamInitials(team.name);
}

function parseGroupLabel(value) {
  if (!value) {
    return "-";
  }
  const groupMatch = String(value).match(/group\s+([A-L])/i);
  if (groupMatch) {
    return groupMatch[1].toUpperCase();
  }
  const bareMatch = String(value).match(/\b([A-L])\b/i);
  if (bareMatch) {
    return bareMatch[1].toUpperCase();
  }
  return String(value);
}

function groupSortValue(group) {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length : index;
}

function sortGroups(groups) {
  return [...groups].sort(
    (first, second) =>
      groupSortValue(first.group) - groupSortValue(second.group) ||
      first.group.localeCompare(second.group)
  );
}

function sortGroupRows(rows) {
  return [...rows].sort(
    (first, second) =>
      first.rank - second.rank ||
      second.points - first.points ||
      second.goalDifference - first.goalDifference ||
      second.goalsFor - first.goalsFor ||
      first.team.name.localeCompare(second.team.name)
  );
}

function teamName(team) {
  return (
    team?.displayName ?? team?.shortDisplayName ?? team?.location ?? team?.name ?? null
  );
}

function teamLogo(team) {
  return team?.logo ?? team?.logos?.find((logo) => logo.href)?.href ?? null;
}

function statValue(stats, name, fallback = 0) {
  const stat = stats?.find(
    (item) =>
      item.name?.toLowerCase() === name.toLowerCase() ||
      item.type?.toLowerCase() === name.toLowerCase()
  );
  return typeof stat?.value === "number" && Number.isFinite(stat.value)
    ? stat.value
    : fallback;
}

function leaderStatValue(stats, name, fallback = null) {
  const stat = stats?.find((item) => item.name?.toLowerCase() === name.toLowerCase());
  return typeof stat?.value === "number" && Number.isFinite(stat.value)
    ? stat.value
    : fallback;
}

function leaderStatistics(leader) {
  return leader.statistics ?? leader.athlete?.statistics;
}

function parseAssistsFromDisplay(value) {
  const match = value?.match(/\bA:\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function topScorerKey(playerName, team, playerId) {
  return playerId
    ? `id:${playerId}`
    : `name:${normalizeTeamName(playerName)}|team:${normalizeTeamName(team)}`;
}

function topScorerNameTeamKey(playerName, team) {
  return `name:${normalizeTeamName(playerName)}|team:${normalizeTeamName(team)}`;
}

function mergeScoreboards(...payloads) {
  const eventsById = new Map();
  for (const payload of payloads) {
    for (const event of payload?.events ?? []) {
      const key =
        event.id ??
        `${event.date ?? "unknown"}-${event.name ?? ""}-${
          event.competitions?.[0]?.id ?? ""
        }`;
      eventsById.set(key, event);
    }
  }
  return { events: [...eventsById.values()] };
}

/* ============================================================
   ESPN ayrıştırma
   ============================================================ */

function parseEspnStandings(payload) {
  return sortGroups(
    (payload.children ?? [])
      .map((child) => {
        const group = parseGroupLabel(child.name ?? child.abbreviation);
        const rows = (child.standings?.entries ?? [])
          .map((entry) => {
            const name = teamName(entry.team);
            if (!name || group === "-") {
              return null;
            }
            const goalsFor = statValue(entry.stats, "pointsFor");
            const goalsAgainst = statValue(entry.stats, "pointsAgainst");
            const rank =
              statValue(entry.stats, "rank", entry.note?.rank ?? 0) ||
              entry.note?.rank ||
              0;

            return {
              group,
              rank,
              team: withTeamVisuals({
                id: entry.team?.id,
                name,
                abbr: entry.team?.abbreviation ?? null,
                logo: teamLogo(entry.team),
              }),
              played: statValue(entry.stats, "gamesPlayed"),
              won: statValue(entry.stats, "wins"),
              drawn: statValue(entry.stats, "ties"),
              lost: statValue(entry.stats, "losses"),
              goalsFor,
              goalsAgainst,
              goalDifference: statValue(
                entry.stats,
                "pointDifferential",
                goalsFor - goalsAgainst
              ),
              points: statValue(entry.stats, "points"),
            };
          })
          .filter(Boolean);

        return rows.length > 0 ? { group, rows: sortGroupRows(rows) } : null;
      })
      .filter(Boolean)
  );
}

function scoreValue(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function goalEventsForMatch(details, match) {
  return (details ?? [])
    .filter((detail) => detail.scoringPlay || detail.type?.text === "Goal")
    .map((detail, index) => {
      const scoringTeam =
        String(detail.team?.id) === String(match.home.id) ? match.home : match.away;
      return {
        id: detail.id ?? `${match.id}-goal-${index}`,
        matchId: match.id,
        minute: detail.clock?.displayValue ?? null,
        clockValue:
          typeof detail.clock?.value === "number" ? detail.clock.value : null,
        team: scoringTeam,
        scorer:
          detail.athletesInvolved?.[0]?.displayName ??
          detail.athletesInvolved?.[0]?.shortName ??
          detail.athletesInvolved?.[0]?.fullName ??
          null,
        isOwnGoal: detail.ownGoal,
        isPenalty: detail.penaltyKick,
      };
    })
    .sort((first, second) => (first.clockValue ?? 0) - (second.clockValue ?? 0));
}

function parseEspnMatches(payload) {
  const liveStates = new Set(["in"]);
  const finishedStates = new Set(["post"]);

  return (payload.events ?? [])
    .map((event) => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors ?? [];
      const home = competitors.find((competitor) => competitor.homeAway === "home");
      const away = competitors.find((competitor) => competitor.homeAway === "away");
      const status = competition?.status ?? event.status;
      const stateName = status?.type?.state ?? "pre";
      const date = event.date ?? competition?.date ?? competition?.startDate;
      const group = parseGroupLabel(competition?.altGameNote ?? event.season?.slug);

      if (!competition || !home?.team || !away?.team || !date) {
        return null;
      }

      const matchBase = {
        id: event.id ?? competition.id ?? `${date}-${home.id}-${away.id}`,
        group,
        round: competition.altGameNote ?? null,
        date,
        venue:
          competition.venue?.fullName ??
          competition.venue?.displayName ??
          event.venue?.displayName ??
          null,
        city: competition.venue?.address?.city ?? null,
        elapsed:
          typeof status?.clock === "number" && liveStates.has(stateName)
            ? Math.floor(status.clock / 60)
            : null,
        home: withTeamVisuals({
          id: home.team.id,
          name: teamName(home.team),
          abbr: home.team.abbreviation ?? null,
          logo: teamLogo(home.team),
        }),
        away: withTeamVisuals({
          id: away.team.id,
          name: teamName(away.team),
          abbr: away.team.abbreviation ?? null,
          logo: teamLogo(away.team),
        }),
        homeGoals: scoreValue(home.score),
        awayGoals: scoreValue(away.score),
        homeShootout:
          typeof home.shootoutScore === "number" ? home.shootoutScore : null,
        awayShootout:
          typeof away.shootoutScore === "number" ? away.shootoutScore : null,
        homeWinner: home.winner === true,
        awayWinner: away.winner === true,
        isLive: liveStates.has(stateName),
        isFinished: finishedStates.has(stateName) || Boolean(status?.type?.completed),
      };

      return {
        ...matchBase,
        goalEvents: goalEventsForMatch(competition.details, matchBase),
      };
    })
    .filter(Boolean)
    .sort((first, second) => Date.parse(first.date) - Date.parse(second.date));
}

function isPlaceholderTeam(name) {
  const normalized = normalizeTeamName(name);
  return (
    normalized === "" ||
    normalized === "tbd" ||
    normalized === "tba" ||
    normalized.includes("to be decided") ||
    normalized.includes("winner") ||
    normalized.includes("runner up") ||
    normalized.includes("2nd place") ||
    normalized.includes("second place") ||
    normalized.startsWith("third place group") ||
    normalized.startsWith("group ")
  );
}

function roundKey(match) {
  const label = String(match.round ?? match.group ?? "").toLowerCase();
  if (label.includes("round of 32")) return "r32";
  if (label.includes("round of 16")) return "r16";
  if (label.includes("quarterfinal")) return "qf";
  if (label.includes("semifinal")) return "sf";
  if (label.includes("third place")) return null;
  if (label.includes("final")) return "final";
  return null;
}

function translateRound(value) {
  const label = String(value ?? "").replace(/^FIFA World Cup,?\s*/i, "");
  const table = [
    [/round of 32/i, "Son 32"],
    [/round of 16/i, "Son 16"],
    [/quarterfinals?/i, "Çeyrek Final"],
    [/semifinals?/i, "Yarı Final"],
    [/third place/i, "Üçüncülük"],
    [/final/i, "Final"],
  ];
  for (const [pattern, translated] of table) {
    if (pattern.test(label)) {
      return translated;
    }
  }
  return label;
}

function stageLabel(match) {
  if (/^[A-L]$/.test(match.group)) {
    return `Grup ${match.group}`;
  }
  return translateRound(match.round ?? match.group ?? "");
}

function calculateTournamentStats(allMatches, payload) {
  const cardEvents = (payload.events ?? []).flatMap(
    (event) => event.competitions?.[0]?.details ?? []
  );
  const yellowCards = cardEvents.filter(
    (detail) => detail.yellowCard || detail.type?.text?.toLowerCase() === "yellow card"
  ).length;
  const redCards = cardEvents.filter(
    (detail) => detail.redCard || detail.type?.text?.toLowerCase() === "red card"
  ).length;
  const scoredMatches = allMatches.filter(
    (match) =>
      (match.isFinished || match.isLive) &&
      match.homeGoals !== null &&
      match.awayGoals !== null
  );
  const totalGoals = scoredMatches.reduce(
    (total, match) => total + (match.homeGoals ?? 0) + (match.awayGoals ?? 0),
    0
  );

  return {
    totalGoals,
    scoredMatches: scoredMatches.length,
    goalsPerMatch: scoredMatches.length > 0 ? totalGoals / scoredMatches.length : null,
    yellowCards,
    redCards,
  };
}

function parseTopScorers(payload) {
  const goalsLeaders = payload?.stats?.find((stat) => stat.name === "goalsLeaders");
  return (goalsLeaders?.leaders ?? [])
    .slice(0, 5)
    .map((leader, index) => {
      const playerName =
        leader.athlete?.displayName ?? leader.athlete?.shortName ?? null;
      const playerTeam = leader.athlete?.team;
      const teamDisplayName = teamName(playerTeam);
      const stats = leaderStatistics(leader);
      const goals = leaderStatValue(stats, "totalGoals", leader.value ?? null) ?? 0;
      if (!playerName || !teamDisplayName) {
        return null;
      }
      return {
        rank: index + 1,
        playerName,
        team: withTeamVisuals({
          id: playerTeam?.id,
          name: teamDisplayName,
          abbr: playerTeam?.abbreviation ?? null,
          logo: teamLogo(playerTeam),
        }),
        goals,
        assists:
          leaderStatValue(stats, "goalAssists") ??
          parseAssistsFromDisplay(leader.shortDisplayValue),
      };
    })
    .filter(Boolean);
}

function topScorerMetadata(payload) {
  const metadata = new Map();
  const goalsLeaders = payload?.stats?.find((stat) => stat.name === "goalsLeaders");

  for (const [index, leader] of (goalsLeaders?.leaders ?? []).entries()) {
    const playerName =
      leader.athlete?.displayName ?? leader.athlete?.shortName ?? null;
    const playerTeam = leader.athlete?.team;
    const teamDisplayName = teamName(playerTeam);
    const stats = leaderStatistics(leader);
    if (!playerName || !teamDisplayName) {
      continue;
    }
    const row = {
      playerName,
      team: withTeamVisuals({
        id: playerTeam?.id,
        name: teamDisplayName,
        abbr: playerTeam?.abbreviation ?? null,
        logo: teamLogo(playerTeam),
      }),
      assists:
        leaderStatValue(stats, "goalAssists") ??
        parseAssistsFromDisplay(leader.shortDisplayValue),
      statOrder: index,
    };
    metadata.set(topScorerKey(playerName, teamDisplayName, leader.athlete?.id), row);
    metadata.set(topScorerNameTeamKey(playerName, teamDisplayName), row);
  }

  return metadata;
}

function parseTopScorersFromScoreboard(payload, statsPayload) {
  const metadata = topScorerMetadata(statsPayload);
  const scorers = new Map();

  for (const event of payload.events ?? []) {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];

    for (const detail of competition?.details ?? []) {
      if (
        !(detail.scoringPlay || detail.type?.text === "Goal") ||
        detail.ownGoal ||
        detail.shootout
      ) {
        continue;
      }

      const athlete = detail.athletesInvolved?.[0];
      const playerName =
        athlete?.displayName ?? athlete?.shortName ?? athlete?.fullName ?? null;
      const scoringTeamId = detail.team?.id ?? athlete?.team?.id;
      const scoringTeam = competitors.find(
        (competitor) => String(competitor.team?.id) === String(scoringTeamId)
      )?.team;
      const fallbackTeam = athlete?.team;
      const scorerTeamName = teamName(scoringTeam) ?? teamName(fallbackTeam);

      if (!playerName || !scorerTeamName) {
        continue;
      }

      const key = topScorerKey(playerName, scorerTeamName, athlete?.id);
      const nameKey = topScorerNameTeamKey(playerName, scorerTeamName);
      const meta = metadata.get(key) ?? metadata.get(nameKey);
      const existing = scorers.get(key);

      scorers.set(key, {
        playerName: meta?.playerName ?? playerName,
        team:
          meta?.team ??
          withTeamVisuals({
            id: scoringTeam?.id ?? fallbackTeam?.id,
            name: scorerTeamName,
            abbr: scoringTeam?.abbreviation ?? null,
            logo: teamLogo(scoringTeam) ?? teamLogo(fallbackTeam),
          }),
        goals: (existing?.goals ?? 0) + 1,
        assists: meta?.assists ?? existing?.assists ?? null,
        statOrder: meta?.statOrder ?? existing?.statOrder,
      });
    }
  }

  const rows = [...scorers.values()].sort(
    (first, second) =>
      second.goals - first.goals ||
      (second.assists ?? 0) - (first.assists ?? 0) ||
      (first.statOrder ?? Number.POSITIVE_INFINITY) -
        (second.statOrder ?? Number.POSITIVE_INFINITY) ||
      first.playerName.localeCompare(second.playerName, "tr-TR")
  );

  if (rows.length === 0) {
    return parseTopScorers(statsPayload);
  }

  return rows.slice(0, 5).map((row, index) => ({ rank: index + 1, ...row }));
}

function buildBracket(allMatches) {
  const rounds = new Map(ROUND_ORDER.map((round) => [round.key, []]));
  for (const match of allMatches) {
    const key = roundKey(match);
    if (key && rounds.has(key)) {
      rounds.get(key).push(match);
    }
  }
  for (const list of rounds.values()) {
    list.sort((first, second) => Date.parse(first.date) - Date.parse(second.date));
  }
  return rounds;
}

function normalizeEspnPayload(
  standingsPayload,
  scoreboardPayload,
  knockoutScoreboardPayload,
  statsPayload,
  tournamentScoreboardPayload
) {
  const groups = parseEspnStandings(standingsPayload);
  const tournamentScoreboard = mergeScoreboards(
    scoreboardPayload,
    knockoutScoreboardPayload,
    tournamentScoreboardPayload
  );
  const allMatches = parseEspnMatches(tournamentScoreboard);
  const liveCount = allMatches.filter((match) => match.isLive).length;
  const now = Date.now();
  const nextKickoff =
    allMatches
      .filter(
        (match) => !match.isFinished && !match.isLive && Date.parse(match.date) >= now
      )
      .sort((first, second) => Date.parse(first.date) - Date.parse(second.date))[0] ??
    null;

  return {
    generatedAt: new Date().toISOString(),
    groups,
    allMatches,
    bracket: buildBracket(allMatches),
    topScorers: parseTopScorersFromScoreboard(tournamentScoreboard, statsPayload),
    tournamentStats: calculateTournamentStats(allMatches, tournamentScoreboard),
    liveCount,
    nextKickoff,
    errors: [],
  };
}

/* ============================================================
   Veri yükleme
   ============================================================ */

async function fetchJson(url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`${url} ${response.status} yanıtı verdi.`);
  }
  return response.json();
}

async function loadData(silent = false) {
  state.loading = !silent && !state.data;
  state.refreshing = silent;
  if (!silent) {
    state.error = null;
    render();
  }

  try {
    const [
      standingsResult,
      scoreboardResult,
      knockoutResult,
      statsResult,
      tournamentResult,
    ] = await Promise.allSettled([
      fetchJson(ESPN_STANDINGS_URL),
      fetchJson(ESPN_SCOREBOARD_URL),
      fetchJson(ESPN_KNOCKOUT_SCOREBOARD_URL),
      fetchJson(ESPN_STATS_URL),
      fetchJson(ESPN_TOURNAMENT_SCOREBOARD_URL),
    ]);

    if (standingsResult.status === "rejected") {
      throw standingsResult.reason;
    }
    if (scoreboardResult.status === "rejected") {
      throw scoreboardResult.reason;
    }

    const payload = normalizeEspnPayload(
      standingsResult.value,
      scoreboardResult.value,
      knockoutResult.status === "fulfilled" ? knockoutResult.value : undefined,
      statsResult.status === "fulfilled" ? statsResult.value : undefined,
      tournamentResult.status === "fulfilled" ? tournamentResult.value : undefined
    );

    if (payload.groups.length === 0) {
      throw new Error("ESPN grup sıralaması yanıtında veri bulunamadı.");
    }

    if (!state.data) {
      state.matchFilter = payload.liveCount > 0 ? "live" : "today";
    }

    state.data = payload;
    state.error = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canlı veri alınamadı.";
    if (!state.data) {
      state.error = message;
    } else {
      state.data = { ...state.data, errors: [message] };
    }
  } finally {
    state.loading = false;
    state.refreshing = false;
    render();
  }
}

/* ============================================================
   Biçimleyiciler
   ============================================================ */

function localDayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function isToday(value) {
  return localDayKey(value) === localDayKey(new Date());
}

function teamMatchesQuery(team, query) {
  return team.name.toLocaleLowerCase("tr-TR").includes(query);
}

function flagMarkup(team, cls = "flag") {
  const source = team.flagUrl ?? team.logo;
  if (!source) {
    return `<span class="${cls}">${escapeHtml(teamInitials(team.name))}</span>`;
  }
  return `<span class="${cls}"><img src="${escapeHtml(source)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();" /></span>`;
}

/* ============================================================
   Üst bar + başlık
   ============================================================ */

function topbarSection(data) {
  return `<div class="topbar">
    <div class="wrap topbar-in">
      <span class="brand"><span class="brand-dot"></span>YOL HARİTASI <span class="yr">’26</span></span>
      ${
        data.liveCount > 0
          ? `<span class="topbar-live"><span class="live-dot"></span>${data.liveCount} canlı</span>`
          : ""
      }
      <div class="topbar-right">
        ${
          data.nextKickoff
            ? `<span class="hide-s">Sıradaki maça <span class="mono" data-countdown="${escapeHtml(
                data.nextKickoff.date
              )}">--:--</span></span>`
            : ""
        }
        <span class="hide-s">Güncellendi <span class="mono">${escapeHtml(
          timeFormatter.format(new Date(data.generatedAt))
        )}</span></span>
        <button class="refresh-btn" data-action="refresh" ${
          state.refreshing ? "disabled" : ""
        }><span class="${state.refreshing ? "spin" : ""}">⟳</span>${
          state.refreshing ? "Yenileniyor" : "Yenile"
        }</button>
      </div>
    </div>
  </div>`;
}

function pageheadSection(data) {
  return `<header class="wrap pagehead">
    <h1>Dünya Kupası Yol Haritası <span class="yr">’26</span></h1>
    <div class="chip-row">
      ${
        data.liveCount > 0
          ? `<span class="chip live"><span class="live-dot"></span>${data.liveCount} maç canlı</span>`
          : ""
      }
      <span class="chip">48 takım · 12 grup</span>
      <span class="chip">104 maç · 16 şehir</span>
      <span class="chip">ABD — Kanada — Meksika</span>
      <span class="chip acc">Her ${REFRESH_SECONDS} sn'de bir canlı</span>
    </div>
  </header>`;
}

/* ============================================================
   Kart satırı: turnuva verisi + krallık + sıradaki maç
   ============================================================ */

function statCard(data) {
  const stats = data.tournamentStats;
  return `<article class="card">
    <div class="card-head">
      <h2>Turnuva Verisi</h2>
      <span class="card-note">Goller ve kartlar</span>
    </div>
    <div class="stat-body">
      <div class="stat-hero">
        <strong>${stats.totalGoals}</strong>
        <span>gol · ${stats.scoredMatches} maçta</span>
      </div>
      <div class="stat-mini-row">
        <div class="stat-mini">
          <div class="v">${
            stats.goalsPerMatch !== null ? stats.goalsPerMatch.toFixed(2) : "–"
          }</div>
          <div class="k">Gol / maç</div>
        </div>
        <div class="stat-mini">
          <div class="v"><span class="chipbox y"></span>${stats.yellowCards}</div>
          <div class="k">Sarı kart</div>
        </div>
        <div class="stat-mini">
          <div class="v"><span class="chipbox r"></span>${stats.redCards}</div>
          <div class="k">Kırmızı</div>
        </div>
        <div class="stat-mini">
          <div class="v">${stats.scoredMatches}</div>
          <div class="k">Oynanan</div>
        </div>
      </div>
    </div>
  </article>`;
}

function scorersCard(data) {
  const scorers = data.topScorers;
  return `<article class="card">
    <div class="card-head">
      <h2>Gol Krallığı</h2>
      <span class="card-note">İlk 5</span>
    </div>
    <div class="list-pad">
      ${
        scorers.length === 0
          ? '<p class="m-empty">Veri bekleniyor.</p>'
          : scorers
              .map(
                (scorer) => `<div class="s-row">
                  <span class="rk">${scorer.rank}</span>
                  ${flagMarkup(scorer.team)}
                  <span class="nm">${escapeHtml(scorer.playerName)}
                    <small>${escapeHtml(scorer.team.name)}${
                      scorer.assists ? ` · ${scorer.assists} asist` : ""
                    }</small>
                  </span>
                  <span class="g">${scorer.goals}</span>
                </div>`
              )
              .join("")
      }
    </div>
  </article>`;
}

function nextMatchCard(data) {
  const next = data.nextKickoff;
  if (!next) {
    return `<article class="card">
      <div class="card-head"><h2>Sıradaki Maç</h2></div>
      <p class="m-empty">Planlanmış maç kalmadı.</p>
    </article>`;
  }
  return `<article class="card">
    <div class="card-head">
      <h2>Sıradaki Maç</h2>
      <span class="card-note">${escapeHtml(stageLabel(next))}</span>
    </div>
    <div class="next-body">
      <div class="next-line">
        <div class="next-team">${flagMarkup(next.home)}<span>${escapeHtml(
          next.home.name
        )}</span></div>
        <span class="next-vs">VS</span>
        <div class="next-team">${flagMarkup(next.away)}<span>${escapeHtml(
          next.away.name
        )}</span></div>
      </div>
      <div class="next-sub">${escapeHtml(dateTimeFormatter.format(new Date(next.date)))}${
        next.venue ? ` · ${escapeHtml(next.venue)}` : ""
      }</div>
      <div class="next-count">
        <span>Başlamasına</span>
        <span class="mono" data-countdown="${escapeHtml(next.date)}">--:--:--</span>
      </div>
    </div>
  </article>`;
}

/* ============================================================
   Takvim şeridi
   ============================================================ */

function timelineCard(data) {
  const byDay = new Map();
  for (const match of data.allMatches) {
    const key = localDayKey(match.date);
    if (!byDay.has(key)) {
      byDay.set(key, []);
    }
    byDay.get(key).push(match);
  }

  const days = [];
  const cursor = new Date(`${TOURNAMENT_START}T12:00:00`);
  const end = new Date(`${TOURNAMENT_END}T12:00:00`);
  const todayKey = localDayKey(new Date());

  while (cursor <= end) {
    const key = localDayKey(cursor);
    const matches = byDay.get(key) ?? [];
    const isTodayCell = key === todayKey;
    const isPast = key < todayKey;

    const lines = matches
      .slice(0, 4)
      .map((match) => {
        const score =
          match.isLive || match.isFinished
            ? `<span class="s">${match.homeGoals ?? "-"}–${match.awayGoals ?? "-"}</span>`
            : `<span class="s">${escapeHtml(
                timeFormatter.format(new Date(match.date))
              )}</span>`;
        return `<div class="day-match${match.isLive ? " live-m" : ""}">${escapeHtml(
          teamShort(match.home)
        )} ${score} ${escapeHtml(teamShort(match.away))}</div>`;
      })
      .join("");

    days.push(`<div class="day${isTodayCell ? " today" : isPast ? " past" : ""}" ${
      isTodayCell ? 'data-today="1"' : ""
    }>
      <div class="day-head">
        <span class="day-num">${cursor.getDate()}</span>
        <span class="day-wd">${
          isTodayCell ? "Bugün" : escapeHtml(weekdayFormatter.format(cursor))
        }</span>
      </div>
      <div class="day-month">${escapeHtml(monthFormatter.format(cursor))}</div>
      ${
        matches.length > 0
          ? `<div class="day-matches">${lines}${
              matches.length > 4
                ? `<div class="day-more">+${matches.length - 4} maç</div>`
                : ""
            }</div>`
          : '<div class="day-empty">Maç yok</div>'
      }
    </div>`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return `<section class="card" style="margin-top:14px" id="takvim">
    <div class="card-head">
      <h2>Takvim</h2>
      <span class="card-note">11 Haziran → 19 Temmuz</span>
    </div>
    <div class="timeline" data-timeline>${days.join("")}</div>
  </section>`;
}

/* ============================================================
   Şampiyonluk yolu (bracket)
   ============================================================ */

function tieRow(team, goals, shootout, isWinner, isLoser) {
  if (isPlaceholderTeam(team.name)) {
    return `<div class="tie-row tbd">
      <span class="tbd-flag"></span>
      <span class="nm">Belirleniyor</span>
      <span class="sc"></span>
    </div>`;
  }
  return `<div class="tie-row${isWinner ? " winner" : ""}${isLoser ? " loser" : ""}">
    ${flagMarkup(team)}
    <span class="nm">${escapeHtml(team.name)}</span>
    <span class="sc">${goals ?? ""}${
      shootout !== null && shootout !== undefined && goals !== null
        ? ` (${shootout})`
        : ""
    }</span>
  </div>`;
}

function bracketCard(data) {
  const columns = ROUND_ORDER.map((round) => {
    const matches = data.bracket.get(round.key) ?? [];
    const body =
      matches.length === 0
        ? '<div class="tie"><div class="tie-row tbd"><span class="tbd-flag"></span><span class="nm">Belirleniyor</span><span class="sc"></span></div></div>'
        : matches
            .map((match) => {
              const meta = match.isLive
                ? `CANLI${match.elapsed !== null ? ` ${match.elapsed}'` : ""}`
                : match.isFinished
                  ? "MS"
                  : dateTimeFormatter.format(new Date(match.date));
              const decided = match.isFinished;
              return `<div class="tie${match.isLive ? " live-tie" : ""}">
                <div class="tie-meta"><span>${escapeHtml(meta)}</span><span>${escapeHtml(
                  match.city ?? ""
                )}</span></div>
                ${tieRow(
                  match.home,
                  match.isLive || match.isFinished ? match.homeGoals : null,
                  match.homeShootout,
                  decided && match.homeWinner,
                  decided && match.awayWinner
                )}
                ${tieRow(
                  match.away,
                  match.isLive || match.isFinished ? match.awayGoals : null,
                  match.awayShootout,
                  decided && match.awayWinner,
                  decided && match.homeWinner
                )}
              </div>`;
            })
            .join("");

    return `<div class="round-col">
      <div class="round-title"><span>${round.label}</span><span class="cnt">${
        matches.length || ""
      }</span></div>
      <div class="round-body">${body}</div>
    </div>`;
  }).join("");

  return `<section class="card" id="yol">
    <div class="card-head">
      <h2>Şampiyonluk Yolu</h2>
      <span class="card-note">Kazanan yeşil · penaltılar parantezde</span>
    </div>
    <div class="bracket">${columns}</div>
  </section>`;
}

/* ============================================================
   Maç merkezi
   ============================================================ */

function filteredMatches(data) {
  const query = state.matchQuery.trim().toLocaleLowerCase("tr-TR");
  let matches = data.allMatches;

  if (state.matchFilter === "live") {
    matches = matches.filter((match) => match.isLive);
  } else if (state.matchFilter === "today") {
    matches = matches.filter((match) => isToday(match.date));
  } else if (state.matchFilter === "upcoming") {
    matches = matches.filter((match) => !match.isFinished && !match.isLive);
  } else if (state.matchFilter === "finished") {
    matches = [...matches.filter((match) => match.isFinished)].reverse();
  }

  if (query) {
    matches = matches.filter(
      (match) =>
        teamMatchesQuery(match.home, query) || teamMatchesQuery(match.away, query)
    );
  }

  return matches;
}

function matchItem(match) {
  const started = match.isLive || match.isFinished;
  const decided = match.isFinished;

  const when = match.isLive
    ? `<div class="m-when live"><span class="big">${
        match.elapsed !== null ? `${match.elapsed}'` : "CANLI"
      }</span></div>`
    : match.isFinished
      ? '<div class="m-when"><span class="big">MS</span></div>'
      : `<div class="m-when"><span class="big">${escapeHtml(
          timeFormatter.format(new Date(match.date))
        )}</span><span>${escapeHtml(
          new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(
            new Date(match.date)
          )
        )}</span></div>`;

  const line = (team, goals, shootout, isWinner, isLoser) => `
    <div class="m-line${isWinner ? " winner" : ""}${isLoser ? " loser" : ""}">
      ${flagMarkup(team)}
      <span class="nm">${escapeHtml(team.name)}</span>
      <span class="g">${started ? (goals ?? "-") : ""}${
        started && shootout !== null && shootout !== undefined ? ` (${shootout})` : ""
      }</span>
    </div>`;

  const goals =
    match.isLive && match.goalEvents.length > 0
      ? `<div class="m-goals">${match.goalEvents
          .map(
            (goal) =>
              `<span>${escapeHtml(goal.minute ?? "")} ${escapeHtml(goal.scorer ?? "?")}${
                goal.isPenalty ? " (P)" : ""
              }${goal.isOwnGoal ? " (KK)" : ""}</span>`
          )
          .join("")}</div>`
      : "";

  return `<div class="m-item${match.isLive ? " live-m" : ""}">
    ${when}
    <div class="m-teams" data-score-id="${escapeHtml(match.id)}">
      ${line(
        match.home,
        match.homeGoals,
        match.homeShootout,
        decided && match.homeWinner,
        decided && match.awayWinner
      )}
      ${line(
        match.away,
        match.awayGoals,
        match.awayShootout,
        decided && match.awayWinner,
        decided && match.homeWinner
      )}
    </div>
    <div class="m-tag">${escapeHtml(stageLabel(match))}${
      match.city ? `<br>${escapeHtml(match.city)}` : ""
    }</div>
    ${goals}
  </div>`;
}

function matchesCard(data) {
  const matches = filteredMatches(data);
  const tabs = [
    ["live", "Canlı"],
    ["today", "Bugün"],
    ["upcoming", "Gelecek"],
    ["finished", "Biten"],
    ["all", "Tümü"],
  ];

  return `<section class="card" id="maclar">
    <div class="card-head">
      <h2>Maç Merkezi</h2>
      <span class="card-note" data-match-count>${matches.length} maç</span>
    </div>
    <div class="mc-tools">
      ${tabs
        .map(
          ([key, label]) =>
            `<button class="mc-tab${
              state.matchFilter === key ? " active" : ""
            }" data-filter="${key}">${label}</button>`
        )
        .join("")}
      <input
        class="mc-search"
        type="search"
        placeholder="Takım ara"
        value="${escapeHtml(state.matchQuery)}"
        data-input="match-query"
        aria-label="Takım ara"
      />
    </div>
    <div class="match-list" aria-live="polite" data-match-table>
      ${
        matches.length > 0
          ? matches.slice(0, 60).map(matchItem).join("")
          : '<div class="m-empty">Bu filtreyle eşleşen maç yok.</div>'
      }
      ${
        matches.length > 60
          ? `<div class="m-empty">+ ${matches.length - 60} maç daha — filtreyi daraltın.</div>`
          : ""
      }
    </div>
  </section>`;
}

/* ============================================================
   Takımını takip et
   ============================================================ */

function teamsFromGroups(groups) {
  return groups
    .flatMap((group) =>
      group.rows.map((row) => ({ ...row.team, group: group.group, rank: row.rank }))
    )
    .sort((first, second) => first.name.localeCompare(second.name, "tr-TR"));
}

function matchInvolvesTeam(match, teamNameNorm) {
  return (
    normalizeTeamName(match.home.name) === teamNameNorm ||
    normalizeTeamName(match.away.name) === teamNameNorm
  );
}

function followCard(data) {
  const teams = teamsFromGroups(data.groups);
  const selectedNorm = state.followedTeam ? normalizeTeamName(state.followedTeam) : null;
  const selected = selectedNorm
    ? teams.find((team) => normalizeTeamName(team.name) === selectedNorm) ?? null
    : null;

  const options = teams
    .map(
      (team) =>
        `<option value="${escapeHtml(team.name)}" ${
          selected && team.name === selected.name ? "selected" : ""
        }>${escapeHtml(team.name)}</option>`
    )
    .join("");

  let panel = "";
  if (selected) {
    const teamMatches = data.allMatches.filter((match) =>
      matchInvolvesTeam(match, normalizeTeamName(selected.name))
    );
    const upcoming = teamMatches.filter((match) => !match.isFinished && !match.isLive);
    const next = upcoming[0] ?? null;
    const lastFinished = [...teamMatches].reverse().find((match) => match.isFinished);
    const eliminated =
      lastFinished &&
      !next &&
      roundKey(lastFinished) !== "final" &&
      ((normalizeTeamName(lastFinished.home.name) === normalizeTeamName(selected.name) &&
        lastFinished.awayWinner) ||
        (normalizeTeamName(lastFinished.away.name) === normalizeTeamName(selected.name) &&
          lastFinished.homeWinner));

    const steps = teamMatches
      .map((match) => {
        const isHome =
          normalizeTeamName(match.home.name) === normalizeTeamName(selected.name);
        const opponent = isHome ? match.away : match.home;
        const own = isHome ? match.homeGoals : match.awayGoals;
        const opp = isHome ? match.awayGoals : match.homeGoals;
        let result = "";
        if (match.isFinished && own !== null && opp !== null) {
          const winner = isHome ? match.homeWinner : match.awayWinner;
          const loser = isHome ? match.awayWinner : match.homeWinner;
          result =
            winner || own > opp
              ? '<span class="res w">G</span>'
              : loser || opp > own
                ? '<span class="res l">M</span>'
                : '<span class="res d">B</span>';
        } else if (match.isLive) {
          result = '<span class="res l">CANLI</span>';
        }
        const isNext = next && match.id === next.id;
        const scoreText =
          match.isFinished || match.isLive
            ? `${own ?? "-"}–${opp ?? "-"}`
            : timeFormatter.format(new Date(match.date));

        return `<div class="road-step${isNext ? " next" : ""}">
          <div class="road-step-round"><span>${escapeHtml(stageLabel(match))}</span>${result}</div>
          <div class="road-step-line">
            ${flagMarkup(opponent)}
            <span>${escapeHtml(opponent.name)}</span>
            <span class="sc">${escapeHtml(scoreText)}</span>
          </div>
          <div class="road-step-sub">${escapeHtml(
            dateTimeFormatter.format(new Date(match.date))
          )}${match.venue ? ` · ${escapeHtml(match.venue)}` : ""}</div>
        </div>`;
      })
      .join("");

    const statusTag = eliminated
      ? '<span class="tag red">Elendi</span>'
      : next
        ? `<span class="tag acc">Sıradaki: ${escapeHtml(stageLabel(next))}</span>`
        : teamMatches.length > 0
          ? '<span class="tag acc">Yolda</span>'
          : "";

    panel = `
      <div class="follow-id">
        ${flagMarkup(selected)}
        <h3>${escapeHtml(selected.name)}</h3>
        <div class="follow-tags">
          <span class="tag">Grup ${escapeHtml(selected.group)} · ${selected.rank}. sıra</span>
          ${statusTag}
        </div>
      </div>
      ${
        teamMatches.length > 0
          ? `<div class="follow-road">${steps}</div>`
          : '<p class="follow-empty">Bu takım için maç verisi bulunamadı.</p>'
      }`;
  }

  return `<section class="card" style="margin-top:14px" id="takip">
    <div class="card-head">
      <h2>Takımını Takip Et</h2>
      <span class="card-note">Seçim bu tarayıcıda hatırlanır</span>
    </div>
    <div class="follow-tools">
      <label for="follow-select">Takım</label>
      <select id="follow-select" data-input="follow-select">
        <option value="">Seçiniz…</option>
        ${options}
      </select>
      ${
        selected
          ? '<button class="follow-clear" data-action="follow-clear">seçimi kaldır</button>'
          : ""
      }
    </div>
    ${panel}
  </section>`;
}

/* ============================================================
   Gruplar
   ============================================================ */

function groupsSection(data) {
  return `<section id="gruplar" style="margin-top:14px">
    <div class="groups">
      ${data.groups
        .map(
          (group) => `<article class="card group-card">
            <div class="card-head">
              <h2>Grup ${escapeHtml(group.group)}</h2>
              <span class="card-note">AV · P</span>
            </div>
            <table>
              <tbody>
                ${group.rows
                  .map(
                    (row) => `<tr${row.rank <= 2 ? ' class="q"' : ""}>
                      <td class="r">${row.rank}</td>
                      <td><span class="t">${flagMarkup(row.team)}<span class="nm">${escapeHtml(
                        row.team.name
                      )}</span></span></td>
                      <td class="n">${row.goalDifference > 0 ? "+" : ""}${
                        row.goalDifference
                      }</td>
                      <td class="n p">${row.points}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </article>`
        )
        .join("")}
    </div>
  </section>`;
}

/* ============================================================
   Render
   ============================================================ */

function render() {
  if (state.loading) {
    return; // index.html'deki skeleton görünür
  }

  if (state.error && !state.data) {
    app.innerHTML = `<div class="error-box">
      <strong>Canlı veri alınamadı.</strong>
      <p style="margin-top:8px;color:var(--muted)">${escapeHtml(state.error)}</p>
      <button class="refresh-btn" data-action="refresh">Tekrar dene</button>
    </div>`;
    bindEvents();
    return;
  }

  const data = state.data;

  const activeElement = document.activeElement;
  const focusKey = activeElement?.dataset?.input ?? null;
  const selectionStart = activeElement?.selectionStart ?? null;
  const timelineScroll = app.querySelector("[data-timeline]")?.scrollLeft ?? null;
  const bracketScroll = app.querySelector(".bracket")?.scrollLeft ?? null;
  const matchScroll = app.querySelector(".match-list")?.scrollTop ?? 0;

  app.innerHTML = `
    ${topbarSection(data)}
    ${pageheadSection(data)}
    <main class="wrap">
      ${
        data.errors?.length
          ? `<div class="notice">Son güncelleme başarısız; önceki veriler gösteriliyor. (${escapeHtml(
              data.errors[0]
            )})</div>`
          : ""
      }
      <div class="grid cards-3">
        ${statCard(data)}
        ${scorersCard(data)}
        ${nextMatchCard(data)}
      </div>
      ${timelineCard(data)}
      <div class="grid main-2">
        ${bracketCard(data)}
        ${matchesCard(data)}
      </div>
      ${followCard(data)}
      ${groupsSection(data)}
      <footer class="site-footer">
        <span>Dünya Kupası Yol Haritası ’26 · Veri: ESPN public API</span>
        <a href="#takvim">Yukarı ↑</a>
      </footer>
    </main>`;

  // Takvimi bugüne kaydır (ilk açılışta) ya da konumu koru
  const timeline = app.querySelector("[data-timeline]");
  if (timeline) {
    if (!state.timelineScrolled) {
      const todayCell = timeline.querySelector('[data-today="1"]');
      if (todayCell) {
        timeline.scrollLeft = Math.max(
          0,
          todayCell.offsetLeft - timeline.clientWidth / 2 + todayCell.clientWidth / 2
        );
      }
      state.timelineScrolled = true;
    } else if (timelineScroll !== null) {
      timeline.scrollLeft = timelineScroll;
    }
  }

  const bracket = app.querySelector(".bracket");
  if (bracket && bracketScroll !== null) {
    bracket.scrollLeft = bracketScroll;
  }

  const matchList = app.querySelector(".match-list");
  if (matchList) {
    matchList.scrollTop = matchScroll;
  }

  if (focusKey) {
    const nextField = app.querySelector(`[data-input="${focusKey}"]`);
    if (nextField) {
      nextField.focus();
      if (selectionStart !== null && nextField.setSelectionRange) {
        try {
          nextField.setSelectionRange(selectionStart, selectionStart);
        } catch {
          /* select alanında yok */
        }
      }
    }
  }

  bindEvents();
  flashChangedScores(data);
  updateCountdowns();
}

function flashChangedScores(data) {
  const nextScores = new Map();
  for (const match of data.allMatches) {
    nextScores.set(String(match.id), `${match.homeGoals}-${match.awayGoals}`);
  }

  if (previousScores.size > 0) {
    for (const [id, score] of nextScores) {
      const before = previousScores.get(id);
      if (before !== undefined && before !== score) {
        const el = app.querySelector(`[data-score-id="${CSS.escape(id)}"]`);
        if (el) {
          el.classList.remove("goal-flash");
          void el.offsetWidth;
          el.classList.add("goal-flash");
        }
      }
    }
  }

  previousScores = nextScores;
}

/* ============================================================
   Etkileşimler
   ============================================================ */

function bindEvents() {
  app.querySelectorAll("[data-action='refresh']").forEach((button) => {
    button.addEventListener("click", () => loadData(false));
  });

  app.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.matchFilter = button.dataset.filter;
      app
        .querySelectorAll("[data-filter]")
        .forEach((tab) =>
          tab.classList.toggle("active", tab.dataset.filter === state.matchFilter)
        );
      renderMatchTableOnly();
    });
  });

  const queryInput = app.querySelector("[data-input='match-query']");
  if (queryInput) {
    queryInput.addEventListener("input", (event) => {
      state.matchQuery = event.target.value;
      renderMatchTableOnly();
    });
  }

  const followSelect = app.querySelector("[data-input='follow-select']");
  if (followSelect) {
    followSelect.addEventListener("change", (event) => {
      state.followedTeam = event.target.value || null;
      try {
        if (state.followedTeam) {
          window.localStorage.setItem(FOLLOW_STORAGE_KEY, state.followedTeam);
        } else {
          window.localStorage.removeItem(FOLLOW_STORAGE_KEY);
        }
      } catch {
        /* storage kapalı */
      }
      render();
      document.querySelector("#takip")?.scrollIntoView({ block: "nearest" });
    });
  }

  const clearButton = app.querySelector("[data-action='follow-clear']");
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      state.followedTeam = null;
      try {
        window.localStorage.removeItem(FOLLOW_STORAGE_KEY);
      } catch {
        /* storage kapalı */
      }
      render();
    });
  }
}

function renderMatchTableOnly() {
  const data = state.data;
  if (!data) {
    return;
  }
  const table = app.querySelector("[data-match-table]");
  const count = app.querySelector("[data-match-count]");
  if (!table) {
    render();
    return;
  }
  const matches = filteredMatches(data);
  table.innerHTML =
    matches.length > 0
      ? matches.slice(0, 60).map(matchItem).join("") +
        (matches.length > 60
          ? `<div class="m-empty">+ ${matches.length - 60} maç daha — filtreyi daraltın.</div>`
          : "")
      : '<div class="m-empty">Bu filtreyle eşleşen maç yok.</div>';
  if (count) {
    count.textContent = `${matches.length} maç`;
  }
}

/* Geri sayım — hem üst bar hem sıradaki maç kartı */
let countdownTimer = null;

function updateCountdowns() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  const els = [...app.querySelectorAll("[data-countdown]")];
  if (els.length === 0) {
    return;
  }

  const tick = () => {
    let anyActive = false;
    for (const el of els) {
      const target = Date.parse(el.dataset.countdown);
      if (!Number.isFinite(target)) {
        continue;
      }
      const diff = target - Date.now();
      if (diff <= 0) {
        el.textContent = "başladı";
        continue;
      }
      anyActive = true;
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);
      el.textContent =
        hours > 48
          ? `${Math.floor(hours / 24)}g ${hours % 24}s`
          : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
              2,
              "0"
            )}:${String(seconds).padStart(2, "0")}`;
    }
    if (!anyActive && countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  };

  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* ============================================================
   Başlat
   ============================================================ */

loadData();
setInterval(() => {
  if (!document.hidden) {
    loadData(true);
  }
}, REFRESH_SECONDS * 1000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadData(true);
  }
});
