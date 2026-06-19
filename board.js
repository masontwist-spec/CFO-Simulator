// Anthropic API call for board commentary

async function getBoardCommentary(archetype, year, snapshot, allocation, history) {
  const totalAllocated = Object.values(allocation).reduce((a, b) => a + b, 0);
  const pct = (v) => totalAllocated > 0 ? `${((v / totalAllocated) * 100).toFixed(0)}%` : '0%';

  const allocationSummary = [
    allocation.reinvest > 0 && `Reinvestment: ${fmt(allocation.reinvest)} (${pct(allocation.reinvest)})`,
    allocation.buybacks > 0 && `Share buybacks: ${fmt(allocation.buybacks)} (${pct(allocation.buybacks)})`,
    allocation.debtPaydown > 0 && `Debt paydown: ${fmt(allocation.debtPaydown)} (${pct(allocation.debtPaydown)})`,
    allocation.dividends > 0 && `Dividends: ${fmt(allocation.dividends)} (${pct(allocation.dividends)})`,
    allocation.acquisitions > 0 && `Acquisitions: ${fmt(allocation.acquisitions)} (${pct(allocation.acquisitions)})`,
  ].filter(Boolean).join('; ') || 'No capital deployed (cash held)';

  const historyContext = history.length > 1
    ? `Prior years' allocations: ${history.slice(1).map((h, i) =>
        `Year ${i + 1}: ${Object.entries(h.allocation || {})
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k} ${fmt(v)}`)
          .join(', ')}`
      ).join(' | ')}`
    : 'This is the first year of decisions.';

  const prompt = `You are the board of directors of ${archetype.name}. ${archetype.backstory}

It is Year ${year} of ${archetype.years}. The CEO has just presented their capital allocation decision.

CURRENT FINANCIALS:
- Revenue: ${fmt(snapshot.revenue)} | EBITDA: ${fmt(snapshot.ebitda)} (${fmtPct(snapshot.ebitdaMargin * 100)} margin)
- Net Income: ${fmt(snapshot.netIncome)} | EPS: $${snapshot.eps.toFixed(2)}
- Free Cash Flow: ${fmt(snapshot.fcf)}
- Debt: ${fmt(snapshot.debt)} | Cash: ${fmt(snapshot.cash)} | Net Debt/EBITDA: ${fmtX(snapshot.debtToEbitda)}
- Interest Coverage: ${fmtX(snapshot.interestCoverage)}
- Implied Stock Price: $${snapshot.stockPrice.toFixed(2)} (EV/EBITDA: ${fmtX(archetype.evMultiple)}x)

THIS YEAR'S ALLOCATION (from ${fmt(snapshot.fcf)} FCF):
${allocationSummary}

${historyContext}

Respond as THREE distinct board members. Each gives ONE pointed, opinionated reaction — maximum 2 sentences each. Be financially specific. Reference actual numbers. Disagree with each other where warranted. No pleasantries.

Format exactly as:
CFO (${archetype.boardPersonalities.cfo}): [reaction]
Board Member (${archetype.boardPersonalities.boardMember}): [reaction]
Independent Director (${archetype.boardPersonalities.independent}): [reaction]`;

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
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}
