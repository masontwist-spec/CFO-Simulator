// Game state machine — orchestrates engine + ui + board

let state = {
  archetype: null,
  year: 1,
  currentState: null,   // raw financial state (inputs to engine)
  history: [],          // [{snapshot, allocation}]
};

function startGame(archetype) {
  state.archetype = archetype;
  state.year = 1;
  state.currentState = { ...archetype.start };
  state.history = [];

  const snapshot = deriveSnapshot(archetype, state.currentState);
  state.history.push({ snapshot, allocation: null });

  showScreen('screen-game');
  renderSnapshot(snapshot, archetype, state.year);
  renderAllocationPanel(snapshot.fcf, handleAllocationSubmit);

  document.getElementById('board-feed').innerHTML = `
    <div class="board-entry board-intro">
      <div class="board-year-label">Board Briefing</div>
      <div class="board-line"><span class="board-comment">${archetype.backstory} You have ${archetype.years} years. Make every dollar count.</span></div>
    </div>`;
}

async function handleAllocationSubmit(allocation) {
  const { archetype, year, currentState, history } = state;
  const currentSnapshot = history[history.length - 1].snapshot;

  // Record allocation against current year entry
  history[history.length - 1].allocation = allocation;

  // Show loading, get board commentary
  showLoading('Consulting the board…');
  let commentary = '';
  try {
    commentary = await getBoardCommentary(archetype, year, currentSnapshot, allocation, history);
  } catch (err) {
    commentary = `[Board commentary unavailable: ${err.message}]`;
  }
  hideLoading();

  renderBoardCommentary(commentary, year);

  // Check if game is over
  if (year >= archetype.years) {
    // Final year — show scorecard after a beat
    setTimeout(() => endGame(), 800);
    return;
  }

  // Advance to next year
  const nextRawState = applyAllocation(archetype, currentSnapshot, allocation);
  const nextSnapshot = deriveSnapshot(archetype, nextRawState);

  state.currentState = nextRawState;
  state.year += 1;
  state.history.push({ snapshot: nextSnapshot, allocation: null });

  renderSnapshot(nextSnapshot, archetype, state.year);
  renderAllocationPanel(nextSnapshot.fcf, handleAllocationSubmit);

  // Scroll allocation panel into view
  document.getElementById('allocation-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function endGame() {
  const scorecard = computeScorecard(state.archetype, state.history);
  renderScorecard(scorecard, state.archetype);
  getFinalBoardVerdict(scorecard);
}

async function getFinalBoardVerdict(scorecard) {
  const { archetype } = state;
  const prompt = `You are the board of ${archetype.name}. The CEO just completed a ${scorecard.years}-year tenure.

Results:
- TSR: ${scorecard.tsr.toFixed(1)}%
- EPS CAGR: ${scorecard.epsCagr.toFixed(1)}%
- Starting stock price: $${scorecard.first.stockPrice.toFixed(2)} → Ending: $${scorecard.last.stockPrice.toFixed(2)}
- Starting EPS: $${scorecard.first.eps.toFixed(2)} → Ending: $${scorecard.last.eps.toFixed(2)}
- Debt change: ${fmt(scorecard.debtReduction > 0 ? scorecard.debtReduction : scorecard.debtReduction)} (${scorecard.debtReduction > 0 ? 'reduced' : 'increased'})
- Total dividends paid: ${fmt(scorecard.totalDividends)}
- Total buybacks: ${fmt(scorecard.totalBuybacks)}

Give a 3-4 sentence final verdict on this CEO's capital allocation track record. Be direct. Reference the numbers. Would you renew the contract?`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await response.json();
    const verdict = data.content[0].text;
    const el = document.getElementById('sc-verdict');
    if (el) el.textContent = verdict;
  } catch {
    // Non-critical, skip silently
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  renderArchetypeSelect(ARCHETYPES, (archetype) => startGame(archetype));

  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    showScreen('screen-intro');
  });
});
