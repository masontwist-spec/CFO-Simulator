// Static rule-based board commentary — no API required

function getStaticCommentary(archetype, snapshot, allocation) {
  const fcf = snapshot.fcf;
  const totalAllocated = Object.values(allocation).reduce((a, b) => a + b, 0);
  const cashHeld = Math.max(0, fcf - totalAllocated);

  const pct = (v) => fcf > 0 ? v / fcf : 0;
  const reinvestPct   = pct(allocation.reinvest);
  const buybacksPct   = pct(allocation.buybacks);
  const debtPct       = pct(allocation.debtPaydown);
  const dividendsPct  = pct(allocation.dividends);
  const acqPct        = pct(allocation.acquisitions);
  const cashHeldPct   = pct(cashHeld);

  const c = {
    holdingAllCash:          totalAllocated < fcf * 0.05,
    holdingMostCash:         cashHeldPct > 0.50,
    dangerousCoverage:       snapshot.interestCoverage < 1.5,
    thinCoverage:            snapshot.interestCoverage >= 1.5 && snapshot.interestCoverage < 2.5,
    highLeverage:            snapshot.debtToEbitda > 4,
    elevatedLeverage:        snapshot.debtToEbitda > 2.5 && snapshot.debtToEbitda <= 4,
    cleanBalance:            snapshot.debtToEbitda < 1.5 || snapshot.debt < 50,
    buybacksDominant:        buybacksPct > 0.35,
    reinvestDominant:        reinvestPct > 0.35,
    debtDominant:            debtPct > 0.35,
    dividendsMeaningful:     dividendsPct > 0.15,
    acqMeaningful:           acqPct > 0.15,
    buybacksOverDebt:        buybacksPct > debtPct + 0.10,
    dividendsWhileLeveraged: snapshot.debtToEbitda > 3.5 && dividendsPct > 0.10,
    acquiringWhileLeveraged: snapshot.debtToEbitda > 3.5 && acqPct > 0.15,
    highRoic:                archetype.roic >= 0.20,
    missedReinvest:          archetype.roic >= 0.20 && reinvestPct < 0.15 && snapshot.debtToEbitda < 3,
    reinvestPct, buybacksPct, debtPct, dividendsPct, acqPct, cashHeldPct,
  };

  const cfoLine         = pickCFO(snapshot, c);
  const boardMemberLine = pickBoardMember(archetype, snapshot, c);
  const independentLine = pickIndependent(archetype, snapshot, c);

  return [
    `CFO (${archetype.boardPersonalities.cfo}): ${cfoLine}`,
    `Board Member (${archetype.boardPersonalities.boardMember}): ${boardMemberLine}`,
    `Independent Director (${archetype.boardPersonalities.independent}): ${independentLine}`,
  ].join('\n');
}


function pickCFO(snapshot, c) {
  const lev    = fmtX(snapshot.debtToEbitda);
  const cov    = fmtX(snapshot.interestCoverage);
  const fcfFmt = fmt(snapshot.fcf);

  if (c.dangerousCoverage && c.buybacksOverDebt && c.highLeverage)
    return `Coverage is ${cov} and we're allocating more to buybacks than debt paydown — that's a covenant breach waiting to happen. The balance sheet has to come before any discretionary return.`;

  if (c.dangerousCoverage)
    return `Interest coverage at ${cov} is in distress territory. I don't care about growth plans or TSR right now — every free dollar needs to go toward debt reduction, no exceptions.`;

  if (c.highLeverage && c.dividendsWhileLeveraged)
    return `Net Debt/EBITDA at ${lev} and we're paying dividends. Lenders are watching our coverage ratios — this signals the wrong balance sheet priorities.`;

  if (c.highLeverage && c.acquiringWhileLeveraged)
    return `We're already at ${lev} leverage and we're layering on acquisition debt. The downside scenario here gets ugly fast — integration risk on top of balance sheet stress is not where I want to be.`;

  if (c.highLeverage && c.debtDominant)
    return `Right call prioritizing debt reduction. Getting from ${lev} toward a more manageable level protects our cost of capital and keeps our options open.`;

  if (c.highLeverage)
    return `${lev} net leverage is not comfortable. I'd like to see more of this FCF directed at the balance sheet rather than discretionary allocation.`;

  if (c.thinCoverage)
    return `Coverage at ${cov} is manageable but tighter than I'd like. Let's keep one eye on the balance sheet as we deploy capital this year.`;

  if (c.elevatedLeverage && c.debtDominant)
    return `Paying down debt from ${lev} is sound defensive treasury management. I sleep better with more cushion against any rate volatility or earnings softness.`;

  if (c.cleanBalance && c.debtDominant)
    return `At ${lev} leverage, aggressively paying down debt has diminishing returns. The balance sheet is already in good shape — there are higher-return uses for this capital.`;

  if (c.holdingAllCash)
    return `We generated ${fcfFmt} in free cash flow and effectively held all of it. That is not capital allocation — it's indecision, and it has a compounding opportunity cost.`;

  if (c.cleanBalance && c.holdingMostCash)
    return `Balance sheet is clean at ${lev} but more than half of FCF is sitting in cash. The drag on returns grows every year we don't find a deployment.`;

  if (c.cleanBalance)
    return `The balance sheet is in good shape at ${lev}. From a treasury perspective, I have no concerns with the liquidity profile this year.`;

  return `No major balance sheet concerns this year. Coverage at ${cov} and leverage at ${lev} are both within an acceptable range.`;
}


function pickBoardMember(archetype, snapshot, c) {
  const lev     = fmtX(snapshot.debtToEbitda);
  const roicFmt = fmtPct(archetype.roic * 100);

  if (c.highLeverage && c.buybacksDominant)
    return `Buybacks while we're at ${lev} leverage is the wrong priority. The balance sheet needs to stabilize first — financial engineering doesn't fix an over-levered structure.`;

  if (c.highLeverage && c.acquiringWhileLeveraged)
    return `Acquisitions are the right instinct for growth, but the leverage makes the timing wrong. We're adding integration risk on top of balance sheet stress — that's two ways to lose at once.`;

  if (c.highLeverage && c.debtDominant)
    return `I understand the case for deleveraging from ${lev}, but once we've stabilized the balance sheet, the conversation has to turn to growth. We can't pay our way to a great business.`;

  if (c.highRoic && c.reinvestDominant && !c.highLeverage)
    return `Reinvesting at ${roicFmt} ROIC is exactly right. Every dollar that goes back into this business earns returns the market will pay a premium multiple for — don't shortchange it.`;

  if (c.missedReinvest && c.buybacksDominant)
    return `We earn ${roicFmt} on invested capital and we're spending the bulk of FCF on buybacks. At this ROIC, reinvestment almost always creates more value per dollar than reducing share count.`;

  if (c.missedReinvest)
    return `${roicFmt} ROIC and we're underdeploying into reinvestment. The highest-return use of FCF in a business like this is growth — not capital return to shareholders.`;

  if (!c.highRoic && c.reinvestDominant)
    return `Reinvesting heavily at ${roicFmt} ROIC concerns me. Below a reasonable hurdle rate, more reinvestment just compounds the problem rather than solving it.`;

  if (c.acqMeaningful && !c.acquiringWhileLeveraged)
    return `I like the M&A appetite. Deploying capital into acquisitions is accretive if we execute the integration well — the key is not overpaying on entry and not fumbling the transition.`;

  if (c.holdingAllCash)
    return `We didn't deploy a single dollar into growth. No reinvestment, no acquisitions — what is the growth thesis here? The competitive landscape does not pause while we sit on cash.`;

  if (c.holdingMostCash && !c.highLeverage)
    return `More than half of FCF in cash is an opportunity cost problem. If reinvestment conviction is low, I'd rather see acquisitions than a growing pile that earns nothing.`;

  if (c.highRoic && c.buybacksDominant)
    return `Buying back stock when we earn ${roicFmt} ROIC is the wrong trade. The best investment available in a business like this is in the business itself — not reducing the share count.`;

  if (c.dividendsMeaningful && c.highRoic)
    return `I'd rather see dividends redirected into reinvestment. A ${roicFmt} ROIC business shouldn't be returning cash to shareholders who will redeploy it at far lower rates elsewhere.`;

  if (c.debtDominant && c.cleanBalance)
    return `Paying down already-modest debt at ${lev} when we have a ${roicFmt} ROIC opportunity in this business is trading a dollar of low-cost debt for a dollar of forgone returns.`;

  return c.highRoic
    ? `With ${roicFmt} ROIC, the bias should always tilt toward reinvestment and growth. We have a compounding machine here — let's keep feeding it.`
    : `Capital allocation looks reasonable this year. I'd like to see more urgency on growth, but no glaring misdeployments.`;
}


function pickIndependent(archetype, snapshot, c) {
  const lev     = fmtX(snapshot.debtToEbitda);
  const roicFmt = fmtPct(archetype.roic * 100);

  if (c.highLeverage && c.buybacksOverDebt)
    return `Buybacks look shareholder-friendly on paper, but at ${lev} leverage the EPS accretion is secondary to covenant risk. This ordering of priorities concerns me.`;

  if (c.holdingAllCash)
    return `Shareholders are paying us to allocate capital — they can hold cash themselves at no cost. We need a deployment thesis for this FCF or the market will discount us for it.`;

  if (c.holdingMostCash)
    return `More than half of FCF parked in cash is a TSR drag. I want to understand the deployment timeline before this becomes an embedded pattern.`;

  if (c.highRoic && c.reinvestDominant)
    return `Reinvesting at ${roicFmt} ROIC is the right move for long-term TSR. Markets price compounders at premium multiples — this is how you earn and defend that multiple.`;

  if (c.missedReinvest)
    return `${roicFmt} ROIC and we're not reinvesting aggressively. That gap between the returns available in this business and our deployment rate is shareholder value left on the table.`;

  if (c.debtDominant && c.highLeverage)
    return `Paying down debt from ${lev} is the right move for shareholders. A delevered, cash-generative business commands a higher multiple — this is the path to TSR recovery.`;

  if (c.debtDominant && c.cleanBalance)
    return `Paying down already-modest debt at ${lev} is capital efficiency pointed in the wrong direction. Buybacks or reinvestment likely deliver better returns per dollar here.`;

  if (c.buybacksDominant && c.cleanBalance && !c.highRoic)
    return `Buybacks at ${lev} leverage with a clean balance sheet is sound capital return. Every share retired at this price is permanently accretive to EPS — I can support this.`;

  if (c.dividendsMeaningful && !c.highLeverage)
    return `A dividend signals confidence but creates a floor the market will penalize us for cutting. I'd want a clear long-term payout policy before we treat this as a recurring commitment.`;

  if (c.acqMeaningful)
    return `Acquisitions carry integration risk that doesn't show up in the pro forma. I'll track this closely — the market often re-rates acquirers downward until results prove the thesis.`;

  if (c.elevatedLeverage && c.buybacksDominant)
    return `Buybacks at ${lev} leverage is a calculated bet. If earnings hold, the accretion is real. If they soften, we've combined shrinking EBITDA with a stretched balance sheet.`;

  return `The metrics will tell the story. I'm watching EPS trajectory and TSR closely — the allocation decisions we make now compound over the full tenure.`;
}


function getStaticVerdict(scorecard) {
  const { tsr, epsCagr, years, first, last } = scorecard;

  if (tsr > 120 && epsCagr > 10)
    return `Exceptional tenure. A ${tsr.toFixed(0)}% TSR with ${epsCagr.toFixed(1)}% EPS CAGR over ${years} years is elite capital allocation by any benchmark — stock moved from $${first.stockPrice.toFixed(2)} to $${last.stockPrice.toFixed(2)}. The compounding effect of disciplined FCF deployment is clearly visible in the numbers. Contract renewal is unanimous.`;

  if (tsr > 80 && epsCagr > 6)
    return `Strong result. TSR of ${tsr.toFixed(0)}% and EPS CAGR of ${epsCagr.toFixed(1)}% over ${years} years reflects sound capital allocation judgment. There were individual decisions that could have been sharpened, but the fundamentals compounded well. The board recommends renewal.`;

  if (tsr > 40)
    return `Solid but unspectacular. TSR of ${tsr.toFixed(0)}% is positive value creation, though EPS CAGR of ${epsCagr.toFixed(1)}% over ${years} years leaves something on the table. Better deployment discipline in the early years could have compounded more effectively. Renewal recommended with higher expectations set.`;

  if (tsr > 0)
    return `Mixed tenure. TSR of ${tsr.toFixed(0)}% over ${years} years is marginally positive, but EPS CAGR of ${epsCagr.toFixed(1)}% and the overall compounding profile suggest capital was not always deployed at its highest-return use. The board would require a sharper allocation strategy before recommending renewal.`;

  if (tsr > -30)
    return `Below expectations. TSR of ${tsr.toFixed(0)}% over ${years} years represents value destruction — stock moved from $${first.stockPrice.toFixed(2)} to $${last.stockPrice.toFixed(2)}. The capital allocation decisions did not generate sufficient returns to justify the trajectory. The board does not recommend renewal without a fundamental rethink of capital strategy.`;

  return `The results are difficult to defend. TSR of ${tsr.toFixed(0)}% over ${years} years is significant shareholder value destruction. Whether through leverage mismanagement, misallocated reinvestment, or missed return opportunities, the numbers speak for themselves. The board does not recommend renewal.`;
}
