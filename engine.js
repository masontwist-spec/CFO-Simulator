// Financial engine — all game math lives here, no DOM touches

function deriveSnapshot(archetype, state) {
  const { revenue, ebitdaMargin, da, debt, cash, sharesOutstanding } = state;
  const ebitda = revenue * ebitdaMargin;
  const ebit = ebitda - da;
  const interestExpense = debt * archetype.interestRate;
  const ebt = ebit - interestExpense;
  const netIncome = Math.max(0, ebt * (1 - archetype.taxRate));
  const maintenanceCapex = revenue * archetype.maintenanceCapexRatio;
  const fcf = netIncome + da - maintenanceCapex;
  const eps = sharesOutstanding > 0 ? netIncome / sharesOutstanding : 0;
  const netDebt = debt - cash;
  const enterpriseValue = ebitda * archetype.evMultiple;
  const equityValue = Math.max(0, enterpriseValue - netDebt);
  const stockPrice = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0;
  const debtToEbitda = ebitda > 0 ? debt / ebitda : Infinity;
  const interestCoverage = interestExpense > 0 ? ebitda / interestExpense : Infinity;

  return {
    revenue,
    ebitdaMargin,
    ebitda,
    da,
    ebit,
    interestExpense,
    ebt,
    netIncome,
    maintenanceCapex,
    fcf,
    eps,
    debt,
    cash,
    netDebt,
    sharesOutstanding,
    enterpriseValue,
    equityValue,
    stockPrice,
    debtToEbitda,
    interestCoverage,
  };
}

// Returns next year's state after applying capital allocation decisions
function applyAllocation(archetype, currentSnapshot, allocation) {
  const {
    revenue, ebitdaMargin, da, debt, cash, sharesOutstanding,
    fcf, stockPrice, ebitda,
  } = currentSnapshot;

  const { reinvest, buybacks, debtPaydown, dividends, acquisitions } = allocation;

  // Validate — total must not exceed FCF (UI enforces, but clamp defensively)
  const total = reinvest + buybacks + debtPaydown + dividends + acquisitions;
  const scale = total > fcf ? fcf / total : 1;
  const r = {
    reinvest: reinvest * scale,
    buybacks: buybacks * scale,
    debtPaydown: debtPaydown * scale,
    dividends: dividends * scale,
    acquisitions: acquisitions * scale,
  };

  // --- Revenue next year ---
  // Base organic growth + ROIC on reinvestment dollars
  const organicGrowth = revenue * archetype.baseGrowthRate;
  // Reinvestment generates additional revenue: dollars * ROIC / (ebitdaMargin)
  // i.e., how much revenue needed to produce that EBITDA at current margins
  const reinvestRevenue = (r.reinvest * archetype.roic) / ebitdaMargin;
  // Acquisitions add EBITDA directly; back-calc to revenue at current margin
  const acquisitionEbitda = r.acquisitions * archetype.acquisitionEbitdaYield;
  const acquisitionRevenue = ebitdaMargin > 0 ? acquisitionEbitda / ebitdaMargin : 0;

  const newRevenue = revenue + organicGrowth + reinvestRevenue + acquisitionRevenue;

  // --- Debt next year ---
  // Acquisitions can be debt-financed (assume 50% debt, 50% cash for simplicity)
  const acquisitionDebtAdded = r.acquisitions * 0.5;
  const newDebt = Math.max(0, debt - r.debtPaydown + acquisitionDebtAdded);

  // --- Cash next year ---
  // Cash changes: +FCF used up by allocations already accounted for, -dividends (cash out), -acquisition cash portion
  const acquisitionCashUsed = r.acquisitions * 0.5;
  const newCash = Math.max(0, cash - r.buybacks - r.debtPaydown - r.dividends - acquisitionCashUsed);
  // Note: reinvestment is assumed to flow through income statement (growth capex hits FCF calc next year)

  // --- Shares outstanding after buybacks ---
  const sharesBought = stockPrice > 0 ? r.buybacks / stockPrice : 0;
  const newShares = Math.max(1, sharesOutstanding - sharesBought);

  // --- D&A grows modestly with asset base ---
  const newDa = da * (1 + archetype.baseGrowthRate * 0.5);

  return {
    revenue: newRevenue,
    ebitdaMargin: ebitdaMargin, // margin held constant; could add complexity later
    da: newDa,
    debt: newDebt,
    cash: newCash,
    sharesOutstanding: newShares,
  };
}

function computeScorecard(archetype, history) {
  const first = history[0].snapshot;
  const last = history[history.length - 1].snapshot;
  const years = history.length - 1;

  const tsr = first.stockPrice > 0
    ? ((last.stockPrice - first.stockPrice) / first.stockPrice) * 100
    : 0;

  const epsCagr = first.eps > 0 && years > 0
    ? (Math.pow(last.eps / first.eps, 1 / years) - 1) * 100
    : 0;

  const debtReduction = first.debt - last.debt;

  const totalDividends = history.reduce((sum, h) => {
    return sum + (h.allocation ? h.allocation.dividends : 0);
  }, 0);

  const totalBuybacks = history.reduce((sum, h) => {
    return sum + (h.allocation ? h.allocation.buybacks : 0);
  }, 0);

  return { tsr, epsCagr, debtReduction, totalDividends, totalBuybacks, first, last, years };
}

function fmt(n, decimals = 1) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(decimals)}B`;
  return `$${n.toFixed(decimals)}M`;
}

function fmtPct(n) {
  return `${n.toFixed(1)}%`;
}

function fmtX(n) {
  if (!isFinite(n)) return '—';
  return `${n.toFixed(1)}x`;
}
