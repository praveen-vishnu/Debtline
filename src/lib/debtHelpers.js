// Pure functions only — no React, no Supabase. Every field name here
// matches the Postgres column name exactly, so data can flow straight
// from a Supabase row into these functions with no mapping layer.

export const LOCALE = "en-IN";
export const CURRENCY = "INR";

export const money = (n) =>
  (n || 0).toLocaleString(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });

/** Compact chart-axis labels: 50000 → 50K, 1500000 → 15L, 10000000 → 1Cr */
export const moneyAxis = (n) => {
  const v = n || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${trimTrailingZero(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}${trimTrailingZero(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}${trimTrailingZero(abs / 1e3)}K`;
  return String(v);
};

function trimTrailingZero(n) {
  return Number(n.toFixed(1)).toString();
}

export const pct = (n) => `${(n || 0).toFixed(1)}%`;

export const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(LOCALE, { day: "2-digit", month: "short", year: "numeric" });
};

export const toInputDate = (d) => new Date(d).toISOString().slice(0, 10);

export const debtLabel = (d) => d.name;

export const debtOutstanding = (d) => {
  if (d.kind === "loan") return d.balance || 0;
  if (d.kind === "card") return d.balance || 0;
  return d.principal_remaining || 0;
};

export const debtOriginal = (d) => {
  if (d.kind === "loan") return d.original || 0;
  if (d.kind === "card") return d.limit_amount || 0;
  return d.original || 0;
};

export const debtRate = (d) => {
  if (d.kind === "loan") return d.rate || 0;
  if (d.kind === "card") return d.apr || 0;
  return (d.monthly_rate || 0) * 12;
};

export const debtProgress = (d) => {
  if (d.kind === "loan") return d.original ? (d.principal_paid / d.original) * 100 : 0;
  if (d.kind === "card") return d.limit_amount ? ((d.limit_amount - d.balance) / d.limit_amount) * 100 : 0;
  return d.original ? (d.principal_paid / d.original) * 100 : 0;
};

export const debtNextDue = (d) => (d.kind === "shark" ? d.next_interest_due : d.next_due);

export const debtMonthlyDue = (d) => {
  if (d.kind === "loan") return d.emi || 0;
  if (d.kind === "card") return d.min_due || 0;
  return ((d.principal_remaining || 0) * (d.monthly_rate || 0)) / 100;
};

export const statusFor = (d, today = new Date()) => {
  const due = debtNextDue(d);
  const days = due ? Math.round((new Date(due) - today) / 86400000) : 999;
  if (days <= 3) return { label: "Due Soon", tone: "warn" };
  if (d.kind === "card" && d.limit_amount && d.balance / d.limit_amount > 0.7) return { label: "High Utilization", tone: "bad" };
  if (d.kind === "shark") return { label: "Active", tone: "shark" };
  return { label: "On Track", tone: "good" };
};

export function computeTotals(debts) {
  const loans = debts.filter((d) => d.kind === "loan");
  const cards = debts.filter((d) => d.kind === "card");
  const sharks = debts.filter((d) => d.kind === "shark");
  const totalOutstanding = debts.reduce((s, d) => s + debtOutstanding(d), 0);
  const totalOriginal =
    loans.reduce((s, d) => s + (d.original || 0), 0) +
    cards.reduce((s, d) => s + (d.limit_amount || 0), 0) +
    sharks.reduce((s, d) => s + (d.original || 0), 0);
  const monthlyPayment = debts.reduce((s, d) => s + debtMonthlyDue(d), 0);
  const totalInterestPaid = loans.reduce((s, d) => s + (d.interest_paid || 0), 0) + sharks.reduce((s, d) => s + (d.interest_paid || 0), 0);
  const totalPrincipalPaid = loans.reduce((s, d) => s + (d.principal_paid || 0), 0) + sharks.reduce((s, d) => s + (d.principal_paid || 0), 0);
  const today = new Date();
  const upcoming7 = debts.filter((d) => {
    const due = debtNextDue(d);
    return due && (new Date(due) - today) / 86400000 <= 7;
  }).length;
  const denom = totalPrincipalPaid + totalOutstanding;
  const debtFreeProgress = denom > 0 ? (totalPrincipalPaid / denom) * 100 : 0;
  return {
    totalOutstanding, totalOriginal, monthlyPayment, totalInterestPaid, totalPrincipalPaid,
    upcoming7, debtFreeProgress, count: debts.length, loans: loans.length, cards: cards.length, sharks: sharks.length,
  };
}

export function simulateStrategy(debts, extra, strategy) {
  let sim = debts.map((d) => ({ ...d }));
  let months = 0, totalInterest = 0;
  const order = () => (strategy === "snowball" ? [...sim].sort((a, b) => a.balance - b.balance) : [...sim].sort((a, b) => b.rate - a.rate));
  while (sim.some((d) => d.balance > 0.5) && months < 600) {
    months++;
    let pool = extra;
    sim.forEach((d) => {
      if (d.balance <= 0) return;
      const interest = (d.balance * (d.rate / 100)) / 12;
      totalInterest += interest;
      d.balance += interest;
      const pay = Math.min(d.minPayment, d.balance);
      d.balance -= pay;
    });
    for (const target of order()) {
      if (pool <= 0) break;
      const tgt = sim.find((x) => x.id === target.id);
      if (!tgt || tgt.balance <= 0) continue;
      const pay = Math.min(pool, tgt.balance);
      tgt.balance -= pay;
      pool -= pay;
    }
  }
  return { months, totalInterest: Math.round(totalInterest) };
}
