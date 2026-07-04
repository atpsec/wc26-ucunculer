(() => {
  const app = document.querySelector('#app');
  if (!app) return;

  let busy = false;
  const base = [
    ['Miroslav Klose', 'Almanya', 16],
    ['Ronaldo', 'Brezilya', 15],
    ['Gerd Müller', 'Almanya', 14],
    ['Just Fontaine', 'Fransa', 13],
    ['Lionel Messi', 'Arjantin', 13],
    ['Kylian Mbappé', 'Fransa', 12],
    ['Pelé', 'Brezilya', 12],
    ['Sándor Kocsis', 'Macaristan', 11],
    ['Jürgen Klinsmann', 'Almanya', 11],
    ['Harry Kane', 'İngiltere', 8],
    ['Cristiano Ronaldo', 'Portekiz', 8]
  ];

  const text = (node) => String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  const norm = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function grid() {
    return app.querySelector('main.wrap > .grid.cards-4');
  }

  function title(card) {
    return text(card.querySelector(':scope > .card-head h2'));
  }

  function topCards() {
    const g = grid();
    return g ? [...g.children].filter((el) => el.classList?.contains('card')) : [];
  }

  function scorersCard() {
    return topCards().find((card) => title(card) === 'Gol Krallığı');
  }

  function currentTournamentGoals() {
    const card = scorersCard();
    const result = new Map();
    if (!card) return result;

    card.querySelectorAll(':scope > .list-pad > .s-row').forEach((row) => {
      const nameBox = row.querySelector('.nm');
      const small = text(nameBox?.querySelector('small'));
      const player = text(nameBox).replace(small, '').trim();
      const goals = Number(text(row.querySelector('.g')).replace(/[^0-9]/g, ''));
      if (player && Number.isFinite(goals)) result.set(norm(player), goals);
    });
    return result;
  }

  function rankingRows() {
    const liveGoals = currentTournamentGoals();
    return base
      .map(([player, country, oldGoals]) => {
        const add = liveGoals.get(norm(player)) || 0;
        return { player, country, add, total: oldGoals + add };
      })
      .sort((a, b) => b.total - a.total || b.add - a.add || a.player.localeCompare(b.player, 'tr-TR'))
      .slice(0, 5);
  }

  function cardHtml() {
    return `<article class="card wc-alltime-card">
      <div class="card-head"><h2>DK Tüm Zamanlar</h2><span class="card-note">2026 dahil</span></div>
      <div class="list-pad">
        ${rankingRows().map((row, index) => `<div class="s-row wc-alltime-row">
          <span class="rk">${index + 1}</span>
          <span class="wc-star">★</span>
          <span class="nm">${row.player}<small>${row.country}${row.add ? ` · 2026: +${row.add}` : ''}</small></span>
          <span class="g">${row.total}</span>
        </div>`).join('')}
      </div>
    </article>`;
  }

  function apply() {
    if (busy) return;
    busy = true;
    try {
      const g = grid();
      if (!g) return;

      g.querySelectorAll(':scope > .wc-alltime-card, :scope > .all-time-card').forEach((node) => node.remove());
      g.querySelectorAll('.all-time-scorers').forEach((node) => node.remove());

      const scorer = scorersCard();
      if (!scorer) return;
      scorer.insertAdjacentHTML('afterend', cardHtml());
      document.body.classList.add('wc-final-card-layout');
    } finally {
      busy = false;
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    body.wc-final-card-layout main.wrap > .grid.cards-4 {
      display: grid !important;
      grid-template-columns: minmax(250px, 1.1fr) minmax(230px, .9fr) minmax(230px, .9fr) minmax(250px, .95fr) minmax(210px, .72fr) !important;
      align-items: stretch;
    }
    .wc-alltime-card .card-head h2::before { background: #d6a21a; }
    .wc-alltime-row { min-height: 50px; border-radius: 10px; background: color-mix(in srgb, var(--surface-2) 72%, transparent); }
    .wc-star { width: 28px; text-align: center; color: #d6a21a; font-size: 13px; }
    .wc-alltime-card .nm { font-size: 13px; }
    .wc-alltime-card .g { color: var(--accent); font-size: 18px; }
    @media (max-width: 1320px) {
      body.wc-final-card-layout main.wrap > .grid.cards-4 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 980px) {
      body.wc-final-card-layout main.wrap > .grid.cards-4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 720px) {
      body.wc-final-card-layout main.wrap > .grid.cards-4 { grid-template-columns: 1fr !important; }
    }
  `;
  document.head.appendChild(style);

  apply();
  new MutationObserver(() => requestAnimationFrame(apply)).observe(app, { childList: true, subtree: true });
})();
