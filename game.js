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

function handleAllocationSubmit(allocation) {
  const { archetype, year, currentState, history } = state;
  const currentSnapshot = history[history.length - 1].snapshot;

  history[history.length - 1].allocation = allocation;

  const commentary = getStaticCommentary(archetype, currentSnapshot, allocation);
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

function getFinalBoardVerdict(scorecard) {
  const verdict = getStaticVerdict(scorecard);
  const el = document.getElementById('sc-verdict');
  if (el) el.textContent = verdict;
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  renderArchetypeSelect(ARCHETYPES, (archetype) => startGame(archetype));

  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    showScreen('screen-intro');
  });
});
