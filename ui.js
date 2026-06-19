// All DOM rendering — no game logic here

function renderArchetypeSelect(archetypes, onSelect) {
  const container = document.getElementById('archetype-select');
  container.innerHTML = '';
  archetypes.forEach(a => {
    const card = document.createElement('div');
    card.className = 'archetype-card';
    card.innerHTML = `
      <div class="archetype-name">${a.name}</div>
      <div class="archetype-tagline">${a.tagline}</div>
      <div class="archetype-backstory">${a.backstory}</div>
    `;
    card.addEventListener('click', () => onSelect(a));
    container.appendChild(card);
  });
}

function renderSnapshot(snapshot, archetype, year) {
  document.getElementById('company-name').textContent = archetype.name;
  document.getElementById('year-indicator').textContent = `Year ${year} of ${archetype.years}`;

  const sp = snapshot.stockPrice;
  const spEl = document.getElementById('stock-price');
  spEl.textContent = `$${sp.toFixed(2)}`;

  setMetric('m-revenue', fmt(snapshot.revenue));
  setMetric('m-ebitda', `${fmt(snapshot.ebitda)} (${fmtPct(snapshot.ebitdaMargin * 100)})`);
  setMetric('m-ebit', fmt(snapshot.ebit));
  setMetric('m-interest', fmt(snapshot.interestExpense));
  setMetric('m-net-income', fmt(snapshot.netIncome));
  setMetric('m-eps', `$${snapshot.eps.toFixed(2)}`);
  setMetric('m-fcf', fmt(snapshot.fcf));
  setMetric('m-debt', fmt(snapshot.debt));
  setMetric('m-cash', fmt(snapshot.cash));
  setMetric('m-net-debt', fmt(snapshot.netDebt));
  setMetric('m-debt-ebitda', fmtX(snapshot.debtToEbitda));
  setMetric('m-coverage', fmtX(snapshot.interestCoverage));
  setMetric('m-shares', `${snapshot.sharesOutstanding.toFixed(1)}M`);
  setMetric('m-ev', fmt(snapshot.enterpriseValue));
  setMetric('m-equity', fmt(snapshot.equityValue));

  // Color debt/EBITDA by severity
  const deEl = document.getElementById('m-debt-ebitda');
  deEl.className = 'metric-value';
  if (snapshot.debtToEbitda > 5) deEl.classList.add('danger');
  else if (snapshot.debtToEbitda > 3) deEl.classList.add('warning');
  else deEl.classList.add('positive');
}

function setMetric(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderAllocationPanel(fcf, onSubmit) {
  document.getElementById('fcf-available').textContent = fmt(fcf);

  const sliders = ['reinvest', 'buybacks', 'debtPaydown', 'dividends', 'acquisitions'];
  sliders.forEach(key => {
    const input = document.getElementById(`input-${key}`);
    const display = document.getElementById(`display-${key}`);
    if (!input || !display) return;
    input.max = Math.ceil(fcf);
    input.value = 0;
    display.textContent = '$0M';
    input.addEventListener('input', () => {
      display.textContent = fmt(parseFloat(input.value) || 0);
      updateRemaining(fcf);
    });
  });

  updateRemaining(fcf);

  const btn = document.getElementById('submit-allocation');
  btn.onclick = () => {
    const allocation = {};
    let total = 0;
    sliders.forEach(key => {
      const v = parseFloat(document.getElementById(`input-${key}`).value) || 0;
      allocation[key] = v;
      total += v;
    });
    if (total > fcf * 1.001) {
      showError(`Total allocated (${fmt(total)}) exceeds FCF (${fmt(fcf)}). Reduce allocations.`);
      return;
    }
    clearError();
    onSubmit(allocation);
  };
}

function updateRemaining(fcf) {
  const sliders = ['reinvest', 'buybacks', 'debtPaydown', 'dividends', 'acquisitions'];
  const total = sliders.reduce((sum, key) => {
    return sum + (parseFloat(document.getElementById(`input-${key}`)?.value) || 0);
  }, 0);
  const remaining = fcf - total;
  const el = document.getElementById('fcf-remaining');
  if (!el) return;
  el.textContent = fmt(Math.max(0, remaining));
  el.className = remaining < -0.5 ? 'danger' : remaining < fcf * 0.05 ? 'warning' : '';
}

function renderBoardCommentary(text, year) {
  const feed = document.getElementById('board-feed');
  const entry = document.createElement('div');
  entry.className = 'board-entry';

  const lines = text.split('\n').filter(l => l.trim());
  const html = lines.map(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const role = line.slice(0, colonIdx);
      const comment = line.slice(colonIdx + 1).trim();
      return `<div class="board-line"><span class="board-role">${role}</span><span class="board-comment">${comment}</span></div>`;
    }
    return `<div class="board-line">${line}</div>`;
  }).join('');

  entry.innerHTML = `<div class="board-year-label">Year ${year} Board Reaction</div>${html}`;
  feed.prepend(entry);
}

function renderScorecard(scorecard, archetype) {
  document.getElementById('screen-game').classList.add('hidden');
  document.getElementById('screen-scorecard').classList.remove('hidden');

  document.getElementById('sc-company').textContent = archetype.name;
  document.getElementById('sc-years').textContent = scorecard.years;
  document.getElementById('sc-tsr').textContent = `${scorecard.tsr.toFixed(1)}%`;
  document.getElementById('sc-eps-cagr').textContent = `${scorecard.epsCagr.toFixed(1)}%`;
  document.getElementById('sc-start-price').textContent = `$${scorecard.first.stockPrice.toFixed(2)}`;
  document.getElementById('sc-end-price').textContent = `$${scorecard.last.stockPrice.toFixed(2)}`;
  document.getElementById('sc-start-eps').textContent = `$${scorecard.first.eps.toFixed(2)}`;
  document.getElementById('sc-end-eps').textContent = `$${scorecard.last.eps.toFixed(2)}`;
  document.getElementById('sc-debt-reduction').textContent = fmt(scorecard.debtReduction);
  document.getElementById('sc-dividends').textContent = fmt(scorecard.totalDividends);
  document.getElementById('sc-buybacks').textContent = fmt(scorecard.totalBuybacks);

  const tsrEl = document.getElementById('sc-tsr');
  tsrEl.className = scorecard.tsr >= 100 ? 'positive' : scorecard.tsr >= 0 ? 'warning' : 'danger';
}

function showLoading(msg) {
  const el = document.getElementById('loading-overlay');
  if (el) {
    el.querySelector('.loading-msg').textContent = msg || 'Consulting the board…';
    el.classList.remove('hidden');
  }
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.add('hidden');
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function clearError() {
  const el = document.getElementById('error-msg');
  if (el) el.classList.add('hidden');
}

function showScreen(id) {
  ['screen-intro', 'screen-game', 'screen-scorecard'].forEach(s => {
    document.getElementById(s)?.classList.add('hidden');
  });
  document.getElementById(id)?.classList.remove('hidden');
}
