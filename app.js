/* ============================================================
   WC26 · En İyi Üçüncüler — canlı veri + koyu tema arayüz
   Veri: ESPN public API (10 sn'de bir yenilenir)
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

const state = {
  data: null,
  loading: true,
  refreshing: false,
  error: null,
  matchFilter: "live",
  matchQuery: "",
  selectedGroup: "all",
  firstRenderDone: false,
};

// Gol flaşı için önceki skorlar (matchId -> "h-a")
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

function withTeamVisuals(team) {
  const name = String(team?.name ?? "").trim() || "Bilinmeyen takım";
  const flagCode = getFlagCode(name);
  return {
    id: team?.id,
    name,
    logo: team?.logo ?? null,
    flagCode,
    flagUrl: getFlagUrl(flagCode),
  };
}

function teamInitials(name) {
  return String(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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

function compareThirdPlaceRows(first, second) {
  return (
    second.points - first.points ||
    second.goalDifference - first.goalDifference ||
    second.goalsFor - first.goalsFor ||
    (second.fairPlay ?? Number.NEGATIVE_INFINITY) -
      (first.fairPlay ?? Number.NEGATIVE_INFINITY) ||
    (first.fifaRank ?? Number.POSITIVE_INFINITY) -
      (second.fifaRank ?? Number.POSITIVE_INFINITY) ||
    first.team.name.localeCompare(second.team.name)
  );
}

function sortProjectedGroupRows(rows) {
  return [...rows].sort(
    (first, second) =>
      second.points - first.points ||
      second.goalDifference - first.goalDifference ||
      second.goalsFor - first.goalsFor ||
      second.won - first.won ||
      first.team.name.localeCompare(second.team.name)
  );
}

function rankThirdPlaceTeams(groups) {
  return sortGroups(groups)
    .map((group) => sortGroupRows(group.rows).find((row) => row.rank === 3))
    .filter(Boolean)
    .sort(compareThirdPlaceRows)
    .map((row, index) => ({
      ...row,
      thirdRank: index + 1,
      qualification: index < 7 ? "inside" : index === 7 ? "edge" : "outside",
    }));
}

function findNextKickoff(matches) {
  const now = Date.now();
  return (
    matches
      .filter((match) => !match.isFinished && Date.parse(match.date) >= now)
      .sort((first, second) => Date.parse(first.date) - Date.parse(second.date))[0] ??
    null
  );
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

function statSummary(stats, name) {
  const stat = stats?.find(
    (item) =>
      item.name?.toLowerCase() === name.toLowerCase() ||
      item.type?.toLowerCase() === name.toLowerCase()
  );
  return stat?.summary ?? stat?.displayValue ?? null;
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

function teamName(team) {
  return (
    team?.displayName ?? team?.shortDisplayName ?? team?.location ?? team?.name ?? null
  );
}

function teamLogo(team) {
  return team?.logo ?? team?.logos?.find((logo) => logo.href)?.href ?? null;
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
            const summary = statSummary(entry.stats, "overall");

            return {
              group,
              rank,
              team: withTeamVisuals({
                id: entry.team?.id,
                name,
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
              form: summary ?? null,
              fairPlay: null,
              fifaRank: null,
              description: entry.note?.description ?? null,
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

function recordPlayed(summary) {
  if (!summary) {
    return null;
  }
  const parts = summary
    .split("-")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));
  return parts.length === 3 ? parts.reduce((total, part) => total + part, 0) : null;
}

function applyResult(row, goalsFor, goalsAgainst) {
  const isWin = goalsFor > goalsAgainst;
  const isDraw = goalsFor === goalsAgainst;
  return {
    ...row,
    played: row.played + 1,
    won: row.won + (isWin ? 1 : 0),
    drawn: row.drawn + (isDraw ? 1 : 0),
    lost: row.lost + (!isWin && !isDraw ? 1 : 0),
    goalsFor: row.goalsFor + goalsFor,
    goalsAgainst: row.goalsAgainst + goalsAgainst,
    goalDifference: row.goalDifference + goalsFor - goalsAgainst,
    points: row.points + (isWin ? 3 : isDraw ? 1 : 0),
    description: "Canlı skor projeksiyonu",
  };
}

function findTeamRow(rows, team) {
  return rows.find(
    (row) =>
      (team.id !== undefined && String(row.team.id) === String(team.id)) ||
      normalizeTeamName(row.team.name) === normalizeTeamName(team.name)
  );
}

function applyLiveScoresToGroups(groups, matches) {
  let applied = false;
  const projectedGroups = groups.map((group) => ({
    group: group.group,
    rows: group.rows.map((row) => ({ ...row })),
  }));

  for (const match of matches) {
    if (
      !match.isLive ||
      match.homeGoals === null ||
      match.awayGoals === null ||
      match.group === "-"
    ) {
      continue;
    }
    const group = projectedGroups.find((item) => item.group === match.group);
    if (!group) {
      continue;
    }
    const homeRow = findTeamRow(group.rows, match.home);
    const awayRow = findTeamRow(group.rows, match.away);
    const homePlayedBefore = recordPlayed(match.homeRecordSummary);
    const awayPlayedBefore = recordPlayed(match.awayRecordSummary);
    if (!homeRow || !awayRow) {
      continue;
    }
    if (
      homePlayedBefore !== null &&
      awayPlayedBefore !== null &&
      (homeRow.played > homePlayedBefore || awayRow.played > awayPlayedBefore)
    ) {
      continue;
    }
    const homeIndex = group.rows.indexOf(homeRow);
    const awayIndex = group.rows.indexOf(awayRow);
    group.rows[homeIndex] = applyResult(homeRow, match.homeGoals, match.awayGoals);
    group.rows[awayIndex] = applyResult(awayRow, match.awayGoals, match.homeGoals);
    group.rows = sortProjectedGroupRows(group.rows).map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
    applied = true;
  }

  return { groups: sortGroups(projectedGroups), applied };
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
        group: match.group,
        minute: detail.clock?.displayValue ?? null,
        clockValue:
          typeof detail.clock?.value === "number" ? detail.clock.value : null,
        team: scoringTeam,
        scorer:
          detail.athletesInvolved?.[0]?.displayName ??
          detail.athletesInvolved?.[0]?.shortName ??
          detail.athletesInvolved?.[0]?.fullName ??
          null,
        home: match.home,
        away: match.away,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        isOwnGoal: detail.ownGoal,
        isPenalty: detail.penaltyKick,
      };
    })
    .sort((first, second) => (second.clockValue ?? 0) - (first.clockValue ?? 0));
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
        statusShort:
          status?.type?.shortDetail ??
          status?.type?.detail ??
          status?.type?.description ??
          stateName,
        statusText:
          status?.type?.detail ??
          status?.type?.description ??
          status?.type?.shortDetail ??
          stateName,
        elapsed:
          typeof status?.clock === "number" && liveStates.has(stateName)
            ? Math.floor(status.clock / 60)
            : null,
        home: withTeamVisuals({
          id: home.team.id,
          name: teamName(home.team),
          logo: teamLogo(home.team),
        }),
        away: withTeamVisuals({
          id: away.team.id,
          name: teamName(away.team),
          logo: teamLogo(away.team),
        }),
        homeGoals: scoreValue(home.score),
        awayGoals: scoreValue(away.score),
        isLive: liveStates.has(stateName),
        isFinished: finishedStates.has(stateName) || Boolean(status?.type?.completed),
        homeRecordSummary: home.records?.[0]?.summary ?? null,
        awayRecordSummary: away.records?.[0]?.summary ?? null,
      };

      return {
        ...matchBase,
        goalEvents: goalEventsForMatch(competition.details, matchBase),
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      if (first.isLive !== second.isLive) {
        return first.isLive ? -1 : 1;
      }
      return Date.parse(first.date) - Date.parse(second.date);
    });
}

function isKnockoutRound(match) {
  const label = `${match.round ?? ""} ${match.group ?? ""}`.toLowerCase();
  return (
    label.includes("round of") ||
    label.includes("quarterfinal") ||
    label.includes("semifinal") ||
    label.includes("final")
  );
}

function isPlaceholderTeam(name) {
  const normalized = normalizeTeamName(name);
  return (
    normalized === "" ||
    normalized === "tbd" ||
    normalized === "tba" ||
    normalized.includes("to be decided") ||
    /^group [a-l] (winner|2nd place|second place|runner up)$/.test(normalized) ||
    normalized.startsWith("third place group") ||
    /^round of (32|16) \d+ winner$/.test(normalized) ||
    /^quarterfinals? \d+ winner$/.test(normalized) ||
    /^semifinals? \d+ winner$/.test(normalized)
  );
}

function findConfirmedMatchups(payload) {
  return parseEspnMatches(payload)
    .filter(
      (match) =>
        isKnockoutRound(match) &&
        !isPlaceholderTeam(match.home.name) &&
        !isPlaceholderTeam(match.away.name)
    )
    .sort((first, second) => Date.parse(first.date) - Date.parse(second.date));
}

function calculateTournamentStats(payload) {
  const matches = parseEspnMatches(payload);
  const cardEvents = (payload.events ?? []).flatMap(
    (event) => event.competitions?.[0]?.details ?? []
  );
  const yellowCards = cardEvents.filter(
    (detail) => detail.yellowCard || detail.type?.text?.toLowerCase() === "yellow card"
  ).length;
  const redCards = cardEvents.filter(
    (detail) => detail.redCard || detail.type?.text?.toLowerCase() === "red card"
  ).length;
  const scoredMatches = matches.filter(
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
        playerId: leader.athlete?.id,
        playerName,
        team: withTeamVisuals({
          id: playerTeam?.id,
          name: teamDisplayName,
          logo: teamLogo(playerTeam),
        }),
        goals,
        assists:
          leaderStatValue(stats, "goalAssists") ??
          parseAssistsFromDisplay(leader.shortDisplayValue),
        appearances: leaderStatValue(stats, "appearances"),
        headshotUrl: leader.athlete?.headshot?.href ?? null,
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
      playerId: leader.athlete?.id,
      playerName,
      team: withTeamVisuals({
        id: playerTeam?.id,
        name: teamDisplayName,
        logo: teamLogo(playerTeam),
      }),
      goals: leaderStatValue(stats, "totalGoals", leader.value ?? null) ?? 0,
      assists:
        leaderStatValue(stats, "goalAssists") ??
        parseAssistsFromDisplay(leader.shortDisplayValue),
      appearances: leaderStatValue(stats, "appearances"),
      headshotUrl: leader.athlete?.headshot?.href ?? null,
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
        playerId: athlete?.id ?? meta?.playerId,
        playerName: meta?.playerName ?? playerName,
        team:
          meta?.team ??
          withTeamVisuals({
            id: scoringTeam?.id ?? fallbackTeam?.id,
            name: scorerTeamName,
            logo: teamLogo(scoringTeam) ?? teamLogo(fallbackTeam),
          }),
        goals: (existing?.goals ?? 0) + 1,
        assists: meta?.assists ?? existing?.assists ?? null,
        appearances: meta?.appearances ?? existing?.appearances ?? null,
        headshotUrl: meta?.headshotUrl ?? athlete?.headshot?.href ?? null,
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

  return rows.slice(0, 5).map((row, index) => ({
    rank: index + 1,
    playerId: row.playerId,
    playerName: row.playerName,
    team: row.team,
    goals: row.goals,
    assists: row.assists,
    appearances: row.appearances,
    headshotUrl: row.headshotUrl,
  }));
}

function normalizeEspnPayload(
  standingsPayload,
  scoreboardPayload,
  knockoutScoreboardPayload,
  statsPayload,
  tournamentScoreboardPayload
) {
  const groups = parseEspnStandings(standingsPayload);
  const matches = parseEspnMatches(scoreboardPayload);
  const tournamentScoreboard = mergeScoreboards(
    scoreboardPayload,
    knockoutScoreboardPayload,
    tournamentScoreboardPayload
  );
  const confirmedMatchups = findConfirmedMatchups(tournamentScoreboard);
  const liveProjection = applyLiveScoresToGroups(groups, matches);
  const goalEvents = matches
    .flatMap((match) => match.goalEvents)
    .sort(
      (first, second) =>
        Date.parse(
          matches.find((match) => match.id === second.matchId)?.date ??
            new Date().toISOString()
        ) -
          Date.parse(
            matches.find((match) => match.id === first.matchId)?.date ??
              new Date().toISOString()
          ) ||
        (second.clockValue ?? 0) - (first.clockValue ?? 0)
    );
  const projectedThirdPlace = rankThirdPlaceTeams(liveProjection.groups).sort(
    compareThirdPlaceRows
  );

  return {
    generatedAt: new Date().toISOString(),
    source: "espn",
    sourceLabel: "ESPN",
    refreshSeconds: REFRESH_SECONDS,
    groups: liveProjection.groups,
    thirdPlace: projectedThirdPlace,
    matches,
    confirmedMatchups,
    topScorers: parseTopScorersFromScoreboard(tournamentScoreboard, statsPayload),
    tournamentStats: calculateTournamentStats(tournamentScoreboard),
    goalEvents,
    liveCount: matches.filter((match) => match.isLive).length,
    liveStandingsApplied: liveProjection.applied,
    nextKickoff: findNextKickoff(matches),
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
  }
  if (!silent) {
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

    // İlk yüklemede akıllı filtre: canlı yoksa bugüne, o da yoksa tümüne düş
    if (!state.data) {
      if (payload.liveCount > 0) {
        state.matchFilter = "live";
      } else if (payload.matches.some((match) => isToday(match.date))) {
        state.matchFilter = "today";
      } else {
        state.matchFilter = "all";
      }
    }

    state.data = payload;
    state.error = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canlı veri alınamadı.";
    // Elde veri varsa koru, sadece uyarı göster
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

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return dateTimeFormatter.format(new Date(value));
}

function formatScore(match) {
  const notStarted = !match.isLive && !match.isFinished;
  if (notStarted || match.homeGoals === null || match.awayGoals === null) {
    return "vs";
  }
  return `${match.homeGoals} - ${match.awayGoals}`;
}

function translateRound(value) {
  const label = String(value ?? "").replace(/^FIFA World Cup,?\s*/i, "");
  const table = [
    [/round of 32/i, "Son 32"],
    [/round of 16/i, "Son 16"],
    [/quarterfinals?/i, "Çeyrek Final"],
    [/semifinals?/i, "Yarı Final"],
    [/third place/i, "Üçüncülük Maçı"],
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
    return `GRUP ${match.group}`;
  }
  return translateRound(match.round ?? match.group ?? "");
}

function isToday(value) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function qualificationLabel(value) {
  if (value === "edge") {
    return "Eşikte";
  }
  return value === "inside" ? "Çıkıyor" : "Dışarıda";
}

function teamMatchesQuery(team, query) {
  return team.name.toLocaleLowerCase("tr-TR").includes(query);
}

/* ============================================================
   Görsel bileşenler
   ============================================================ */

function flagMarkup(team, extraClass = "flag") {
  const source = team.flagUrl ?? team.logo;
  const label = `${team.name} bayrağı`;
  if (!source) {
    return `<span class="${extraClass}">${escapeHtml(teamInitials(team.name))}</span>`;
  }
  return `<span class="${extraClass}"><img src="${escapeHtml(source)}" alt="${escapeHtml(
    label
  )}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();" /></span>`;
}

function teamCell(team, compact = false, align = "left") {
  return `<div class="team-cell${compact ? " compact" : ""}${
    align === "right" ? " align-right" : ""
  }">
    ${flagMarkup(team)}
    <span class="team-name">${escapeHtml(team.name)}</span>
  </div>`;
}

function formDots(form) {
  if (!form) {
    return "";
  }
  const dots = String(form)
    .toUpperCase()
    .replace(/[^WDL]/g, "")
    .slice(-5)
    .split("")
    .map((c) => `<i class="${c === "W" ? "w" : c === "D" ? "d" : "l"}"></i>`)
    .join("");
  return dots ? `<span class="form-dots" title="Son maçlar">${dots}</span>` : "";
}

/* ------------------ Ticker ------------------ */

function tickerItem(match) {
  const score = formatScore(match);
  const minute = match.isLive
    ? `<span class="t-min">${match.elapsed !== null ? `${match.elapsed}'` : "CANLI"}</span>`
    : match.isFinished
      ? `<span style="color:var(--faint);font-size:10.5px;font-weight:800">MS</span>`
      : `<span style="color:var(--sky);font-size:10.5px;font-weight:800">${escapeHtml(
          timeFormatter.format(new Date(match.date))
        )}</span>`;

  return `<span class="ticker-item">
    ${minute}
    ${flagMarkup(match.home, "t-flag")}
    <span>${escapeHtml(match.home.name)}</span>
    <span class="mono-score">${escapeHtml(score)}</span>
    <span>${escapeHtml(match.away.name)}</span>
    ${flagMarkup(match.away, "t-flag")}
  </span>`;
}

function tickerBar(data) {
  const liveMatches = data.matches.filter((m) => m.isLive);
  const todays = data.matches.filter((m) => isToday(m.date));
  const shown = liveMatches.length > 0 ? liveMatches : todays.slice(0, 10);

  if (shown.length === 0) {
    const next = data.nextKickoff;
    return `<div class="ticker-bar">
      <span class="ticker-label idle">Program</span>
      <div class="ticker-viewport">
        <div class="ticker-track" style="animation:none">
          <span class="ticker-item">${
            next
              ? `Sıradaki maç: <strong style="color:var(--ink)">${escapeHtml(
                  next.home.name
                )} – ${escapeHtml(next.away.name)}</strong>&nbsp;· ${escapeHtml(
                  formatDateTime(next.date)
                )}`
              : "Bugün planlanmış maç yok"
          }</span>
        </div>
      </div>
    </div>`;
  }

  const items = shown.map(tickerItem).join("");
  const duration = Math.max(26, shown.length * 9);
  const isLive = liveMatches.length > 0;

  return `<div class="ticker-bar">
    <span class="ticker-label${isLive ? "" : " idle"}">
      ${isLive ? '<span class="live-dot"></span> Canlı' : "Bugün"}
    </span>
    <div class="ticker-viewport">
      <div class="ticker-track" style="--ticker-duration:${duration}s">
        ${items}${items}
      </div>
    </div>
  </div>`;
}

/* ------------------ Hero ------------------ */

function heroSection(data) {
  const liveBadge =
    data.liveCount > 0
      ? `<span class="badge red"><span class="live-dot"></span>${data.liveCount} canlı maç</span>`
      : `<span class="badge sky">⚽ 2026 FIFA Dünya Kupası</span>`;

  const next = data.nextKickoff;

  return `<header class="hero reveal" id="top">
    <div class="hero-row">
      <div class="hero-copy">
        <div class="badge-row">
          ${liveBadge}
          <span class="badge green">48 takım · 12 grup</span>
          <span class="badge">Kaynak: ${escapeHtml(data.sourceLabel)}</span>
          ${
            data.liveStandingsApplied
              ? '<span class="badge amber">Canlı puan projeksiyonu aktif</span>'
              : ""
          }
        </div>
        <h1>En iyi üçüncüler<br /><span class="grad">yarışı canlı</span></h1>
        <p>
          12 grubun üçüncülerinden en iyi 8'i son 32 turuna kalıyor. Skorlar,
          puan durumu ve sıralama her ${REFRESH_SECONDS} saniyede bir otomatik güncellenir.
        </p>
      </div>
      <div class="hero-actions">
        <button class="refresh-button" data-action="refresh" ${
          state.refreshing ? "disabled" : ""
        }>
          <span class="refresh-symbol${state.refreshing ? " spin" : ""}">⟳</span>
          ${state.refreshing ? "Güncelleniyor…" : "Şimdi yenile"}
        </button>
        <span class="last-updated">Son güncelleme
          <strong>${escapeHtml(timeFormatter.format(new Date(data.generatedAt)))}</strong>
        </span>
        ${
          next
            ? `<span class="countdown-chip">Sıradaki maça
                <span class="mono" data-countdown="${escapeHtml(next.date)}">--:--:--</span>
              </span>`
            : ""
        }
      </div>
    </div>
  </header>`;
}

/* ------------------ Metrikler ------------------ */

function metricsSection(data) {
  const stats = data.tournamentStats;
  const scorers = data.topScorers;

  const scorerContent =
    scorers.length === 0
      ? '<p class="scorer-empty">Veri bekleniyor</p>'
      : `<div class="scorer-list">${scorers
          .slice(0, 5)
          .map(
            (scorer) => `<div class="scorer-row">
              <div class="scorer-main">
                <span class="scorer-rank">${scorer.rank}</span>
                ${flagMarkup(scorer.team)}
                <div class="scorer-copy">
                  <strong>${escapeHtml(scorer.playerName)}</strong>
                  <span>${escapeHtml(scorer.team.name)}</span>
                </div>
              </div>
              <span class="goal-badge">${escapeHtml(scorer.goals)}</span>
            </div>`
          )
          .join("")}</div>`;

  const teamGoals = data.groups
    .flatMap((group) => group.rows)
    .sort(
      (first, second) =>
        second.goalsFor - first.goalsFor ||
        second.goalDifference - first.goalDifference ||
        second.points - first.points ||
        first.team.name.localeCompare(second.team.name)
    )
    .slice(0, 5);

  return `<section class="metrics reveal" id="istatistik">
    <article class="metric">
      <div class="metric-label"><span>Turnuva golleri</span><span class="badge-mini green">⚽</span></div>
      <div class="total-goals">
        <span>Toplam gol</span>
        <strong>${stats.totalGoals}</strong>
      </div>
      <p class="metric-sub">${stats.scoredMatches} maçta · maç başı ${
        stats.goalsPerMatch !== null ? stats.goalsPerMatch.toFixed(2) : "-"
      }</p>
    </article>

    <article class="metric">
      <div class="metric-label"><span>Kartlar</span><span class="badge-mini amber">▮</span></div>
      <div class="card-total-grid">
        <div class="card-total yellow"><span>Sarı</span><strong>${stats.yellowCards}</strong></div>
        <div class="card-total red"><span>Kırmızı</span><strong>${stats.redCards}</strong></div>
      </div>
      <p class="metric-sub">Turnuva geneli</p>
    </article>

    <article class="metric">
      <div class="metric-label"><span>Gol krallığı</span><span class="badge-mini sky">👑</span></div>
      ${scorerContent}
    </article>

    <article class="metric">
      <div class="metric-label"><span>En golcü ülkeler</span><span class="badge-mini green">G</span></div>
      <div class="scorer-list">${teamGoals
        .map(
          (row, index) => `<div class="scorer-row">
            <div class="scorer-main">
              <span class="scorer-rank">${index + 1}</span>
              ${flagMarkup(row.team)}
              <div class="scorer-copy">
                <strong>${escapeHtml(row.team.name)}</strong>
                <span>Grup ${escapeHtml(row.group)}</span>
              </div>
            </div>
            <span class="goal-badge">${escapeHtml(row.goalsFor)}</span>
          </div>`
        )
        .join("")}</div>
    </article>
  </section>`;
}

/* ------------------ Üçüncüler yarışı ------------------ */

function thirdRaceSection(data) {
  const rows = data.thirdPlace;

  if (rows.length === 0) {
    return `<section class="section-card reveal" id="ucunculer">
      <div class="section-head">
        <div class="section-title"><span class="icon">🎯</span><h2>En iyi üçüncüler yarışı</h2></div>
      </div>
      <p class="empty">Gruplar oynandıkça üçüncüler burada sıralanacak.</p>
    </section>`;
  }

  const maxScore = Math.max(
    ...rows.map((row) => row.points * 10 + Math.max(-9, Math.min(9, row.goalDifference)) + 9),
    1
  );

  const rowMarkup = (row) => {
    const barScore =
      row.points * 10 + Math.max(-9, Math.min(9, row.goalDifference)) + 9;
    const width = Math.max(4, Math.round((barScore / maxScore) * 100));
    const gdClass = row.goalDifference > 0 ? "pos" : row.goalDifference < 0 ? "neg" : "";
    const gdText = `${row.goalDifference > 0 ? "+" : ""}${row.goalDifference}`;

    return `<div class="race-row ${row.qualification}">
      <span class="race-rank">${row.thirdRank}</span>
      <div class="race-team">
        ${flagMarkup(row.team)}
        <span class="team-name">${escapeHtml(row.team.name)}</span>
        <span class="race-group">${escapeHtml(row.group)}</span>
      </div>
      <div class="race-bar-wrap"><div class="race-bar" style="width:${width}%"></div></div>
      <div class="race-stats">
        <span class="race-pts">${row.points} P</span>
        <span class="race-gd ${gdClass}">${gdText}</span>
      </div>
    </div>`;
  };

  const inside = rows.filter((row) => row.qualification !== "outside");
  const outside = rows.filter((row) => row.qualification === "outside");

  return `<section class="section-card reveal" id="ucunculer">
    <div class="section-head">
      <div class="section-title"><span class="icon">🎯</span><h2>En iyi üçüncüler yarışı</h2></div>
      <div class="section-note">
        ${
          data.liveStandingsApplied
            ? '<span class="badge-mini red">● canlı projeksiyon</span>'
            : ""
        }
        <span>İlk 8 son 32'ye kalır</span>
      </div>
    </div>
    <div class="race-body">
      ${inside.map(rowMarkup).join("")}
      ${
        outside.length > 0
          ? `<div class="race-cutoff">Son 32 barajı</div>${outside
              .map(rowMarkup)
              .join("")}`
          : ""
      }
    </div>
    <div class="race-legend">
      <span><i class="li-in"></i>İçeride (1-7)</span>
      <span><i class="li-edge"></i>Eşikte (8.)</span>
      <span><i class="li-out"></i>Dışarıda</span>
      <span style="margin-left:auto">Bar: puan + averaj ağırlığı</span>
    </div>
  </section>`;
}

/* ------------------ Maç listesi ------------------ */

function matchStatus(match) {
  if (match.isLive) {
    return `<span class="status live"><span class="live-dot"></span>${
      match.elapsed !== null ? `${match.elapsed}'` : "CANLI"
    }</span>`;
  }
  if (match.isFinished) {
    return `<span class="status">MS</span>`;
  }
  return `<span class="status scheduled">${escapeHtml(
    timeFormatter.format(new Date(match.date))
  )}</span>`;
}

function matchCard(match) {
  const goalRows = (match.goalEvents ?? [])
    .slice(0, 3)
    .map(
      (goal) => `<div class="goal-mini-row">
        <span>⚽ ${escapeHtml(goal.scorer ?? "Bilinmiyor")}${
          goal.isPenalty ? " (P)" : ""
        }${goal.isOwnGoal ? " (KK)" : ""} · ${escapeHtml(goal.team.name)}</span>
        <span class="mono">${escapeHtml(goal.minute ?? "")}</span>
      </div>`
    )
    .join("");

  return `<article class="match-card${match.isLive ? " is-live" : ""}" data-match-id="${escapeHtml(
    match.id
  )}">
    <div>
      <div class="match-meta">
        <span>${escapeHtml(stageLabel(match))}</span>
        <span>${escapeHtml(formatDateTime(match.date))}</span>
      </div>
      <div class="score-line">
        ${teamCell(match.home, true)}
        <span class="score" data-score-id="${escapeHtml(match.id)}">${escapeHtml(
          formatScore(match)
        )}</span>
        <div class="away-cell">${teamCell(match.away, true, "right")}</div>
      </div>
      ${
        match.venue
          ? `<div class="venue">📍 ${escapeHtml(match.venue)}${
              match.city ? ` · ${escapeHtml(match.city)}` : ""
            }</div>`
          : ""
      }
      ${goalRows ? `<div class="goal-mini">${goalRows}</div>` : ""}
    </div>
    <div class="match-status">${matchStatus(match)}</div>
  </article>`;
}

function filteredMatches(data) {
  const query = state.matchQuery.trim().toLocaleLowerCase("tr-TR");
  return data.matches.filter((match) => {
    if (state.matchFilter === "live" && !match.isLive) {
      return false;
    }
    if (state.matchFilter === "today" && !isToday(match.date)) {
      return false;
    }
    if (
      state.selectedGroup !== "all" &&
      match.group !== state.selectedGroup
    ) {
      return false;
    }
    if (
      query &&
      !teamMatchesQuery(match.home, query) &&
      !teamMatchesQuery(match.away, query)
    ) {
      return false;
    }
    return true;
  });
}

function matchesSection(data) {
  const matches = filteredMatches(data);
  const groupOptions = GROUP_ORDER.map(
    (group) =>
      `<option value="${group}" ${
        state.selectedGroup === group ? "selected" : ""
      }>Grup ${group}</option>`
  ).join("");

  const emptyLabel =
    state.matchFilter === "live"
      ? "Şu anda canlı maç yok. «Bugün» veya «Tümü» filtresini deneyin."
      : "Bu filtreyle eşleşen maç bulunamadı.";

  return `<section class="section-card reveal" id="maclar">
    <div class="section-head">
      <div class="section-title"><span class="icon">📺</span><h2>Maç merkezi</h2></div>
      <div class="section-note"><span>${matches.length} maç görüntüleniyor</span></div>
    </div>
    <div class="match-toolbar">
      <div class="match-top">
        <div class="controls">
          <label class="search-box">
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              placeholder="Takım ara…"
              value="${escapeHtml(state.matchQuery)}"
              data-input="match-query"
              aria-label="Takım ara"
            />
          </label>
          <select data-input="group-filter" aria-label="Grup filtresi">
            <option value="all" ${
              state.selectedGroup === "all" ? "selected" : ""
            }>Tüm gruplar</option>
            ${groupOptions}
          </select>
        </div>
      </div>
      <div class="filters">
        <button class="filter-button${
          state.matchFilter === "live" ? " active" : ""
        }" data-filter="live">● Canlı</button>
        <button class="filter-button${
          state.matchFilter === "today" ? " active" : ""
        }" data-filter="today">Bugün</button>
        <button class="filter-button${
          state.matchFilter === "all" ? " active" : ""
        }" data-filter="all">Tümü</button>
      </div>
    </div>
    <div class="match-list" aria-live="polite">
      ${matches.length > 0 ? matches.map(matchCard).join("") : `<p class="empty">${emptyLabel}</p>`}
    </div>
    ${
      data.nextKickoff
        ? `<div class="next-kickoff">
            <strong>Sıradaki maç: ${escapeHtml(data.nextKickoff.home.name)} – ${escapeHtml(
              data.nextKickoff.away.name
            )}</strong>
            <span>${escapeHtml(formatDateTime(data.nextKickoff.date))}</span>
          </div>`
        : ""
    }
  </section>`;
}

/* ------------------ Son goller ------------------ */

function recentGoalsSection(data) {
  const goals = data.goalEvents.slice(0, 4);
  if (goals.length === 0) {
    return "";
  }

  return `<section class="section-card reveal">
    <div class="section-head">
      <div class="section-title"><span class="icon">⚽</span><h2>Son goller</h2></div>
    </div>
    <div class="goal-grid">
      ${goals
        .map(
          (goal) => `<div class="goal-item">
            ${flagMarkup(goal.team)}
            <div class="goal-copy">
              <strong>${escapeHtml(goal.scorer ?? "Bilinmiyor")}</strong>
              <span>${escapeHtml(goal.home.name)} ${goal.homeGoals ?? "-"}-${
                goal.awayGoals ?? "-"
              } ${escapeHtml(goal.away.name)}</span>
            </div>
            <span class="goal-min">${escapeHtml(goal.minute ?? "")}</span>
          </div>`
        )
        .join("")}
    </div>
  </section>`;
}

/* ------------------ Son 16 ------------------ */

function knockoutSection(data) {
  const matchups = data.confirmedMatchups;

  return `<section class="section-card reveal" id="eslesmeler">
    <div class="section-head">
      <div class="section-title"><span class="icon">🏆</span><h2>Kesinleşen eleme eşleşmeleri</h2></div>
      <div class="section-note"><span>${matchups.length} eşleşme</span></div>
    </div>
    ${
      matchups.length === 0
        ? '<p class="empty">Henüz kesinleşmiş eşleşme yok. Gruplar tamamlandıkça burada görünecek.</p>'
        : `<div class="knockout-list">
            ${matchups
              .map(
                (match) => `<div class="knockout-item">
                  <div class="knockout-meta">
                    <span>${escapeHtml(translateRound(match.round) || "Eleme")}</span>
                    <span>${escapeHtml(formatDateTime(match.date))}</span>
                  </div>
                  <div class="knockout-line">
                    ${teamCell(match.home, true)}
                    <span class="versus">${
                      match.homeGoals !== null && match.awayGoals !== null
                        ? `${match.homeGoals}-${match.awayGoals}`
                        : "VS"
                    }</span>
                    <div class="away-cell">${teamCell(match.away, true, "right")}</div>
                  </div>
                </div>`
              )
              .join("")}
          </div>`
    }
  </section>`;
}

/* ------------------ Performans tablosu ------------------ */

function comparePerformanceRows(first, second) {
  return (
    second.points - first.points ||
    second.goalDifference - first.goalDifference ||
    second.goalsFor - first.goalsFor ||
    second.won - first.won ||
    first.goalsAgainst - second.goalsAgainst ||
    first.team.name.localeCompare(second.team.name)
  );
}

function performanceSection(data) {
  const rows = data.groups
    .flatMap((groupItem) => groupItem.rows)
    .sort(comparePerformanceRows)
    .map((row, index) => ({ ...row, performanceRank: index + 1 }));

  const body = rows
    .map((row) => {
      const rowClass =
        row.performanceRank <= 8
          ? "performance-top"
          : row.rank <= 2
            ? "performance-qualified"
            : row.rank === 3
              ? "performance-third"
              : "";

      return `<tr class="${rowClass}">
        <td class="strong num" style="text-align:left">${row.performanceRank}</td>
        <td>${teamCell(row.team, true)}</td>
        <td><span class="group-pill">${escapeHtml(row.group)}</span></td>
        <td class="num">${row.played}</td>
        <td class="num">${row.won}</td>
        <td class="num strong">${row.points}</td>
        <td class="num">${row.goalDifference > 0 ? "+" : ""}${row.goalDifference}</td>
        <td class="num">${row.goalsFor}</td>
        <td class="num">${row.goalsAgainst}</td>
      </tr>`;
    })
    .join("");

  return `<section class="section-card reveal">
    <div class="section-head">
      <div class="section-title"><span class="icon">📊</span><h2>48 takım genel performans</h2></div>
      <div class="section-note">
        ${
          data.liveStandingsApplied
            ? '<span class="badge-mini red">● canlı puan</span>'
            : ""
        }
        <span>Anlık sonuçlara göre</span>
      </div>
    </div>
    <div class="performance-scroll">
      <table class="performance-table">
        <thead>
          <tr>
            <th>#</th><th>Ülke</th><th>Grup</th><th class="num">O</th><th class="num">G</th>
            <th class="num">P</th><th class="num">AV</th><th class="num">A</th><th class="num">Y</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
}

/* ------------------ Gruplar ------------------ */

function groupsSection(data) {
  return `<section class="reveal" id="gruplar">
    <div class="section-head" style="border:0;padding:0 4px 14px">
      <div class="section-title"><span class="icon">🗂️</span><h2>Grup puan durumları</h2></div>
      <div class="section-note"><span>Üçüncü sıra vurgulu</span></div>
    </div>
    <div class="groups">
      ${data.groups
        .map(
          (group) => `<article class="group-card">
            <div class="group-head">
              <h3>Grup <span class="g-letter">${escapeHtml(group.group)}</span></h3>
              <span>O · G · B · M · AV · P</span>
            </div>
            <div class="table-scroll">
              <table>
                <tbody>
                  ${group.rows
                    .map(
                      (row) => `<tr class="${row.rank === 3 ? "third-in-group" : ""}">
                        <td class="strong" style="width:20px">${row.rank}</td>
                        <td>${teamCell(row.team, true)} ${formDots(row.form)}</td>
                        <td class="num">${row.played}</td>
                        <td class="num">${row.won}</td>
                        <td class="num">${row.drawn}</td>
                        <td class="num">${row.lost}</td>
                        <td class="num">${row.goalDifference > 0 ? "+" : ""}${
                          row.goalDifference
                        }</td>
                        <td class="num strong">${row.points}</td>
                      </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </article>`
        )
        .join("")}
    </div>
  </section>`;
}

/* ------------------ Footer ------------------ */

function footerSection(data) {
  return `<footer class="site-footer">
    <span>WC26 Üçüncüler Paneli · Veri: ESPN public API · ${REFRESH_SECONDS} sn'de bir otomatik yenilenir</span>
    <a href="#top">↑ Başa dön</a>
  </footer>`;
}

/* ============================================================
   Render
   ============================================================ */

function render() {
  if (state.loading) {
    // index.html'deki skeleton zaten görünüyor; dokunma
    return;
  }

  if (state.error && !state.data) {
    app.innerHTML = `<div class="error-box">
      <p><strong>Canlı veri alınamadı.</strong></p>
      <p style="margin-top:8px;font-weight:500">${escapeHtml(state.error)}</p>
      <p style="margin-top:12px"><button class="refresh-button" data-action="refresh">Tekrar dene</button></p>
    </div>`;
    bindEvents();
    return;
  }

  const data = state.data;

  // Odak/scroll durumunu koru
  const activeElement = document.activeElement;
  const focusKey = activeElement?.dataset?.input ?? null;
  const selectionStart = activeElement?.selectionStart ?? null;
  const matchListScroll = app.querySelector(".match-list")?.scrollTop ?? 0;
  const perfScroll = app.querySelector(".performance-scroll")?.scrollTop ?? 0;

  const revealClass = state.firstRenderDone ? "" : "reveal";

  app.innerHTML = `
    ${tickerBar(data)}
    <div class="shell">
      <div class="container">
        <nav class="section-nav" aria-label="Bölümler">
          <a href="#ucunculer">Üçüncüler</a>
          <a href="#maclar">Maçlar</a>
          <a href="#gruplar">Gruplar</a>
          <a href="#eslesmeler">Eleme</a>
          <a href="#istatistik">İstatistik</a>
        </nav>
        ${heroSection(data)}
        ${data.errors?.length ? `<div class="notice"><p>Son güncelleme denemesi başarısız oldu; bir önceki veriler gösteriliyor.</p><p>${escapeHtml(data.errors[0])}</p></div>` : ""}
        ${metricsSection(data)}
        <div class="grid-main">
          ${thirdRaceSection(data)}
          ${matchesSection(data)}
        </div>
        ${recentGoalsSection(data)}
        ${groupsSection(data)}
        <div class="standings-grid">
          ${performanceSection(data)}
          ${knockoutSection(data)}
        </div>
        ${footerSection(data)}
      </div>
    </div>`;

  // Reveal animasyonu sadece ilk render'da
  if (state.firstRenderDone) {
    app.querySelectorAll(".reveal").forEach((el) => el.classList.remove("reveal"));
  } else {
    app.querySelectorAll(".reveal").forEach((el, index) => {
      el.style.animationDelay = `${Math.min(index * 70, 420)}ms`;
    });
    state.firstRenderDone = true;
  }

  // Scroll konumlarını geri yükle
  const matchList = app.querySelector(".match-list");
  if (matchList) {
    matchList.scrollTop = matchListScroll;
  }
  const perfPanel = app.querySelector(".performance-scroll");
  if (perfPanel) {
    perfPanel.scrollTop = perfScroll;
  }

  // Odak geri yükle
  if (focusKey) {
    const nextField = app.querySelector(`[data-input="${focusKey}"]`);
    if (nextField) {
      nextField.focus();
      if (selectionStart !== null && nextField.setSelectionRange) {
        try {
          nextField.setSelectionRange(selectionStart, selectionStart);
        } catch {
          /* select elementinde yok */
        }
      }
    }
  }

  bindEvents();
  flashChangedScores(data);
  updateCountdown();
  setupScrollSpy();
}

/* Gol flaşı: skoru değişen maçların skor kutusuna animasyon */
function flashChangedScores(data) {
  const nextScores = new Map();
  for (const match of data.matches) {
    nextScores.set(String(match.id), `${match.homeGoals}-${match.awayGoals}`);
  }

  if (previousScores.size > 0) {
    for (const [id, score] of nextScores) {
      const before = previousScores.get(id);
      if (before !== undefined && before !== score) {
        const el = app.querySelector(`[data-score-id="${CSS.escape(id)}"]`);
        if (el) {
          el.classList.remove("goal-flash");
          // reflow ile animasyonu yeniden tetikle
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
      render();
    });
  });

  const queryInput = app.querySelector("[data-input='match-query']");
  if (queryInput) {
    queryInput.addEventListener("input", (event) => {
      state.matchQuery = event.target.value;
      renderMatchListOnly();
    });
  }

  const groupSelect = app.querySelector("[data-input='group-filter']");
  if (groupSelect) {
    groupSelect.addEventListener("change", (event) => {
      state.selectedGroup = event.target.value;
      renderMatchListOnly();
    });
  }
}

/* Arama yazarken tüm sayfayı değil sadece maç listesini güncelle */
function renderMatchListOnly() {
  const data = state.data;
  if (!data) {
    return;
  }
  const list = app.querySelector(".match-list");
  const note = app.querySelector("#maclar .section-note span");
  if (!list) {
    render();
    return;
  }
  const matches = filteredMatches(data);
  const emptyLabel =
    state.matchFilter === "live"
      ? "Şu anda canlı maç yok. «Bugün» veya «Tümü» filtresini deneyin."
      : "Bu filtreyle eşleşen maç bulunamadı.";
  list.innerHTML =
    matches.length > 0
      ? matches.map(matchCard).join("")
      : `<p class="empty">${emptyLabel}</p>`;
  if (note) {
    note.textContent = `${matches.length} maç görüntüleniyor`;
  }
}

/* Geri sayım: saniyede bir sadece metni güncelle */
let countdownTimer = null;

function updateCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  const el = app.querySelector("[data-countdown]");
  if (!el) {
    return;
  }

  const target = Date.parse(el.dataset.countdown);
  if (!Number.isFinite(target)) {
    return;
  }

  const tick = () => {
    const diff = target - Date.now();
    if (diff <= 0) {
      el.textContent = "Başladı!";
      clearInterval(countdownTimer);
      countdownTimer = null;
      return;
    }
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1_000);
    el.textContent =
      hours > 48
        ? `${Math.floor(hours / 24)} gün ${hours % 24} sa`
        : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
            seconds
          ).padStart(2, "0")}`;
  };

  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* Scroll-spy: görünür bölüme göre nav vurgusu */
let scrollSpyObserver = null;

function setupScrollSpy() {
  if (scrollSpyObserver) {
    scrollSpyObserver.disconnect();
  }

  const links = [...app.querySelectorAll(".section-nav a")];
  if (links.length === 0) {
    return;
  }

  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  scrollSpyObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) {
        return;
      }
      links.forEach((link) =>
        link.classList.toggle(
          "active",
          link.getAttribute("href") === `#${visible.target.id}`
        )
      );
    },
    { rootMargin: "-15% 0px -55% 0px", threshold: [0.05, 0.25, 0.5] }
  );

  sections.forEach((section) => scrollSpyObserver.observe(section));
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
