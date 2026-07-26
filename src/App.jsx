import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard, CreditCard, Wallet, Calendar, BarChart3, Calculator,
  FileText, Building2, Settings, Sun, Moon, Search, TrendingDown, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, X, Download, SlidersHorizontal, Flame,
  Landmark, Plus, Trash2, Info, Loader2, RefreshCw
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, Legend
} from "recharts";
import { useDebts } from "./hooks/useDebts";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import {
  savePasskey, loadPasskey, clearPasskey, isPasskeyConfigured, isPasskeyMatch,
} from "./lib/accessControl";
import {
  money, pct, fmtDate, toInputDate, moneyAxis, debtLabel, debtOutstanding, debtOriginal,
  debtRate, debtProgress, debtNextDue, debtMonthlyDue, statusFor, computeTotals,
  simulateStrategy,
} from "./lib/debtHelpers";

const COLORS = { indigo: "#4F46E5", indigoSoft: "#818CF8", sky: "#0EA5E9", emerald: "#10B981", amber: "#F59E0B", rose: "#F43F5E" };
const PIE_COLORS = ["#4F46E5", "#0EA5E9", "#F59E0B", "#10B981", "#F43F5E", "#8B5CF6"];

/* ---------------------------------------------------------------
   SMALL UI PRIMITIVES
---------------------------------------------------------------- */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border transition-colors duration-300 bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] dark:bg-slate-900 dark:border-slate-800 dark:shadow-none ${className}`}>
      {children}
    </div>
  );
}

function Badge({ tone = "good", children }) {
  const tones = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    warn: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
    bad: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
    shark: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20",
    neutral: "bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

function Runway({ percent, tone = "indigo" }) {
  const toneMap = { indigo: "bg-indigo-600 dark:bg-indigo-500", orange: "bg-orange-500", sky: "bg-sky-500" };
  const ticks = [20, 40, 60, 80];
  return (
    <div className="relative h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${toneMap[tone]} transition-[width] duration-700 ease-out`} style={{ width: `${Math.min(100, Math.max(2, percent))}%` }} />
      {ticks.map((t) => <div key={t} className="absolute top-0 h-full w-px bg-white/60 dark:bg-slate-950/40" style={{ left: `${t}%` }} />)}
    </div>
  );
}

function IconTile({ icon: Icon, tone = "indigo" }) {
  const toneMap = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  };
  return <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneMap[tone]}`}><Icon size={18} strokeWidth={2} /></div>;
}

/* ---------------------------------------------------------------
   SUMMARY + DEBT CARDS
---------------------------------------------------------------- */

function SummaryGrid({ t }) {
  const items = [
    { label: "Total Outstanding", value: money(t.totalOutstanding), icon: Wallet, tone: "indigo", sub: `across ${t.count} debts` },
    { label: "Total Original Debt", value: money(t.totalOriginal), icon: Landmark, tone: "sky", sub: "principal + limits" },
    { label: "Monthly Payment", value: money(Math.round(t.monthlyPayment)), icon: Calendar, tone: "indigo", sub: "this cycle" },
    { label: "Total Interest Paid", value: money(t.totalInterestPaid), icon: TrendingUp, tone: "rose", sub: "lifetime" },
    { label: "Principal Paid", value: money(t.totalPrincipalPaid), icon: TrendingDown, tone: "emerald", sub: "lifetime" },
    { label: "Upcoming (7 days)", value: `${t.upcoming7} payments`, icon: Clock, tone: "orange", sub: "due soon" },
    { label: "Debt-Free Progress", value: pct(t.debtFreeProgress), icon: Flame, tone: "indigo", sub: "of total paid off" },
    { label: "Active Debts", value: `${t.count}`, icon: CreditCard, tone: "sky", sub: `${t.loans} loans · ${t.cards} cards · ${t.sharks} informal` },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {items.map((it) => (
        <Card key={it.label} className="p-5">
          <IconTile icon={it.icon} tone={it.tone} />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{it.label}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">{it.value}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{it.sub}</p>
        </Card>
      ))}
    </div>
  );
}

function LoanCard({ d, onView, onPay, canEdit }) {
  const s = statusFor(d);
  const monthsPct = d.total_months ? ((d.total_months - d.months_remaining) / d.total_months) * 100 : 0;
  return (
    <Card className="p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-400 font-medium">{d.category}</p>
          <h3 className="mt-0.5 font-display text-base font-semibold text-slate-900 dark:text-white">{d.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{d.lender}</p>
        </div>
        <Badge tone={s.tone === "good" ? "good" : "warn"}>{s.label}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Original</p><p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{money(d.original)}</p></div>
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Remaining</p><p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{money(d.balance)}</p></div>
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Interest Rate</p><p className="font-medium text-slate-800 dark:text-slate-200">{pct(d.rate)}</p></div>
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">EMI</p><p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{money(d.emi)}/mo</p></div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-1.5"><span>{d.months_remaining} months remaining</span><span>{fmtDate(d.next_due)}</span></div>
        <Runway percent={monthsPct} />
      </div>
      <div className="mt-5 flex gap-2">
        <button onClick={() => onView(d)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">View Details</button>
        {canEdit ? (
          <button onClick={() => onPay(d)} className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">Make Payment</button>
        ) : (
          <div className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm text-slate-400 dark:border-slate-700">Locked</div>
        )}
      </div>
    </Card>
  );
}

function CardDebtCard({ d, onPay, onView, canEdit }) {
  const util = d.limit_amount ? (d.balance / d.limit_amount) * 100 : 0;
  return (
    <Card className="p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-sky-600 dark:text-sky-400 font-medium">Credit Card</p>
          <h3 className="mt-0.5 font-display text-base font-semibold text-slate-900 dark:text-white">{d.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{d.lender}</p>
        </div>
        <Badge tone={util > 70 ? "bad" : "good"}>{util > 70 ? "High Utilization" : "Healthy"}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Outstanding</p><p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{money(d.balance)}</p></div>
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Available Credit</p><p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{money(d.limit_amount - d.balance)}</p></div>
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">APR</p><p className="font-medium text-slate-800 dark:text-slate-200">{pct(d.apr)}</p></div>
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Min Due</p><p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{money(d.min_due)}</p></div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-1.5"><span>{pct(util)} utilization</span><span>Due {fmtDate(d.next_due)}</span></div>
        <Runway percent={util} tone="sky" />
      </div>
      <div className="mt-5 flex gap-2">
        <button onClick={() => onView(d)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Transactions</button>
        {canEdit ? (
          <button onClick={() => onPay(d)} className="flex-1 rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors">Pay Card</button>
        ) : (
          <div className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm text-slate-400 dark:border-slate-700">Locked</div>
        )}
      </div>
    </Card>
  );
}

function SharkCard({ d, onPayInterest, onPayPrincipal, canEdit }) {
  const monthlyInterestAmt = ((d.principal_remaining || 0) * (d.monthly_rate || 0)) / 100;
  const progressPct = d.original ? (d.principal_paid / d.original) * 100 : 0;
  return (
    <Card className="p-5 border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-50/60 to-white dark:from-orange-500/[0.04] dark:to-slate-900 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1"><AlertTriangle size={12} /> Informal Loan</p>
          <h3 className="mt-0.5 font-display text-base font-semibold text-slate-900 dark:text-white">{d.borrower}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">No fixed term · high risk</p>
        </div>
        <Badge tone="shark">{pct(d.monthly_rate)}/mo</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Principal Remaining</p><p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{money(d.principal_remaining)}</p></div>
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Monthly Interest</p><p className="font-medium text-orange-700 dark:text-orange-400 tabular-nums">{money(Math.round(monthlyInterestAmt))}</p></div>
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Principal Paid</p><p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{money(d.principal_paid)}</p></div>
        <div><p className="text-slate-400 dark:text-slate-500 text-xs">Interest Paid</p><p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{money(d.interest_paid)}</p></div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-1.5"><span>{pct(progressPct)} principal paid down</span><span>Interest due {fmtDate(d.next_interest_due)}</span></div>
        <Runway percent={progressPct} tone="orange" />
      </div>
      <div className="mt-5 flex gap-2">
        {canEdit ? (
          <>
            <button onClick={() => onPayInterest(d)} className="flex-1 rounded-xl border border-orange-300 dark:border-orange-800 px-3 py-2 text-sm font-medium text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">Pay Interest</button>
            <button onClick={() => onPayPrincipal(d)} className="flex-1 rounded-xl bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500 transition-colors">Pay Principal</button>
          </>
        ) : (
          <div className="w-full rounded-xl border border-orange-200 px-3 py-2 text-center text-sm text-orange-600 dark:border-orange-900/60 dark:text-orange-400">Locked</div>
        )}
      </div>
    </Card>
  );
}

function DebtCardRouter({ d, onView, onPay, onPayInterest, onPayPrincipal, canEdit }) {
  if (d.kind === "loan") return <LoanCard d={d} onView={onView} onPay={onPay} canEdit={canEdit} />;
  if (d.kind === "card") return <CardDebtCard d={d} onView={onView} onPay={onPay} canEdit={canEdit} />;
  return <SharkCard d={d} onPayInterest={onPayInterest} onPayPrincipal={onPayPrincipal} canEdit={canEdit} />;
}

/* ---------------------------------------------------------------
   UPCOMING PAYMENTS TABLE
---------------------------------------------------------------- */

function UpcomingPaymentsTable({ debts, onPay, canEdit }) {
  const rows = useMemo(
    () => [...debts].map((d) => ({ d, due: new Date(debtNextDue(d) || Date.now()), amount: debtMonthlyDue(d) })).sort((a, b) => a.due - b.due),
    [debts]
  );
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 pb-0"><h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">Upcoming Payments</h3></div>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 border-y border-slate-100 dark:border-slate-800">
              <th className="px-5 py-3 font-medium">Due Date</th><th className="px-5 py-3 font-medium">Debt Name</th>
              <th className="px-5 py-3 font-medium">Lender</th><th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Amount Due</th><th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, due, amount }) => {
              const s = statusFor(d);
              return (
                <tr key={d.id} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDate(due)}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{debtLabel(d)}</td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{d.lender}</td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{d.category}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap">{money(Math.round(amount))}</td>
                  <td className="px-5 py-3.5"><Badge tone={s.tone === "good" ? "good" : s.tone === "shark" ? "shark" : "warn"}>{s.label}</Badge></td>
                  <td className="px-5 py-3.5 text-right">{canEdit ? <button onClick={() => onPay(d, d.kind === "shark" ? "interest" : "payment")} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Pay</button> : <span className="text-slate-400">Locked</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No debts yet — add one to get started.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------
   PAGE: DASHBOARD
---------------------------------------------------------------- */

function DashboardPage({ debts, t, openDetail, openPayment, openAdd, canEdit }) {
  return (
    <div className="space-y-6">
      <SummaryGrid t={t} />
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Your Debts</h2>
          {canEdit && (
            <button onClick={openAdd} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
              <Plus size={15} /> Add Debt
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {debts.map((d) => (
            <DebtCardRouter key={d.id} d={d} onView={openDetail} onPay={(deb) => openPayment(deb, "payment")} onPayInterest={(deb) => openPayment(deb, "interest")} onPayPrincipal={(deb) => openPayment(deb, "principal")} canEdit={canEdit} />
          ))}
          {debts.length === 0 && <div className="col-span-full text-center py-16 text-slate-400 dark:text-slate-500">No debts tracked yet. Click "Add Debt" to start.</div>}
        </div>
      </div>
      <UpcomingPaymentsTable debts={debts} onPay={openPayment} canEdit={canEdit} />
    </div>
  );
}

/* ---------------------------------------------------------------
   PAGE: ALL DEBTS
---------------------------------------------------------------- */

function AllDebtsPage({ debts, openDetail, openPayment, openAdd, canEdit }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Highest Balance");
  const types = ["All", "Home Loan", "Car Loan", "Personal Loan", "Education Loan", "Credit Card", "Informal Loan"];

  const filtered = useMemo(() => {
    let list = debts.filter((d) => {
      const label = debtLabel(d).toLowerCase();
      const matchesQuery = label.includes(query.toLowerCase()) || (d.lender || "").toLowerCase().includes(query.toLowerCase());
      const matchesType = typeFilter === "All" || d.category === typeFilter;
      return matchesQuery && matchesType;
    });
    const sorters = {
      "Highest Balance": (a, b) => debtOutstanding(b) - debtOutstanding(a),
      "Lowest Balance": (a, b) => debtOutstanding(a) - debtOutstanding(b),
      "Highest Interest": (a, b) => debtRate(b) - debtRate(a),
      "Next Due Date": (a, b) => new Date(debtNextDue(a) || 0) - new Date(debtNextDue(b) || 0),
    };
    return [...list].sort(sorters[sortBy]);
  }, [debts, query, typeFilter, sortBy]);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by debt name or lender…" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent pl-9 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {types.map((tp) => (
              <button key={tp} onClick={() => setTypeFilter(tp)} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${typeFilter === tp ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>{tp}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <SlidersHorizontal size={14} className="text-slate-400" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
              {["Highest Balance", "Lowest Balance", "Highest Interest", "Next Due Date"].map((sVal) => <option key={sVal} value={sVal} className="dark:bg-slate-900">{sVal}</option>)}
            </select>
            {canEdit && (
              <button onClick={openAdd} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors whitespace-nowrap">
                <Plus size={15} /> Add Debt
              </button>
            )}
          </div>
        </div>
      </Card>
      <p className="text-sm text-slate-400 dark:text-slate-500">{filtered.length} of {debts.length} debts</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((d) => (
          <DebtCardRouter key={d.id} d={d} onView={openDetail} onPay={(deb) => openPayment(deb, "payment")} onPayInterest={(deb) => openPayment(deb, "interest")} onPayPrincipal={(deb) => openPayment(deb, "principal")} canEdit={canEdit} />
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-16 text-slate-400 dark:text-slate-500">No debts match your filters.</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   PAGE: PAYMENTS
---------------------------------------------------------------- */

function PaymentsPage({ history }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-5">
        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">Payment History</h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Every payment recorded in Supabase, most recent first</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 border-y border-slate-100 dark:border-slate-800">
              <th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Debt</th>
              <th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Principal</th><th className="px-5 py-3 font-medium">Interest</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((p) => (
              <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDate(p.date)}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{p.debt_name}</td>
                <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{p.type}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100 tabular-nums">{money(p.amount)}</td>
                <td className="px-5 py-3.5 text-emerald-600 dark:text-emerald-400 tabular-nums">{money(p.principal)}</td>
                <td className="px-5 py-3.5 text-rose-500 dark:text-rose-400 tabular-nums">{money(p.interest)}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No payments recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------
   PAGE: CALENDAR
---------------------------------------------------------------- */

function CalendarPage({ debts }) {
  const rows = useMemo(() => [...debts].filter((d) => debtNextDue(d)).map((d) => ({ d, due: new Date(debtNextDue(d)) })).sort((a, b) => a.due - b.due), [debts]);
  const grouped = rows.reduce((acc, r) => {
    const key = fmtDate(r.due);
    acc[key] = acc[key] || [];
    acc[key].push(r.d);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-start gap-3">
        <Info size={16} className="text-indigo-500 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Simplified list view of upcoming due dates, grouped by date — no month-grid calendar library is wired up here.</p>
      </Card>
      {Object.entries(grouped).map(([date, ds]) => (
        <Card key={date} className="p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">{date}</p>
          <div className="space-y-2">
            {ds.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5">
                <div><p className="text-sm font-medium text-slate-800 dark:text-slate-100">{debtLabel(d)}</p><p className="text-xs text-slate-400 dark:text-slate-500">{d.lender}</p></div>
                <p className="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">{money(Math.round(debtMonthlyDue(d)))}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
      {rows.length === 0 && <Card className="p-10 text-center text-slate-400">Nothing scheduled — add a debt to populate this view.</Card>}
    </div>
  );
}

/* ---------------------------------------------------------------
   PAGE: REPORTS
   Note: the three "illustrative trend" charts are static example
   series, not derived from your Supabase data. Wiring a real month-
   over-month trend needs periodic snapshots of your balances (e.g. a
   monthly cron job that inserts a row into a `balance_history` table)
   which isn't set up here — a schema change if you want it.
---------------------------------------------------------------- */

const debtReductionSeries = [
  { month: "Feb", balance: 2360000 }, { month: "Mar", balance: 2315000 }, { month: "Apr", balance: 2278000 },
  { month: "May", balance: 2236000 }, { month: "Jun", balance: 2194000 }, { month: "Jul", balance: 2150000 },
];
const monthlyPaymentSeries = [
  { month: "Feb", amount: 78200 }, { month: "Mar", amount: 78200 }, { month: "Apr", amount: 79800 },
  { month: "May", amount: 78200 }, { month: "Jun", amount: 81500 }, { month: "Jul", amount: 78300 },
];
const cashFlowSeries = [
  { month: "Feb", income: 185000, debt: 78200 }, { month: "Mar", income: 185000, debt: 78200 }, { month: "Apr", income: 192000, debt: 79800 },
  { month: "May", income: 185000, debt: 78200 }, { month: "Jun", income: 210000, debt: 81500 }, { month: "Jul", income: 195000, debt: 78300 },
];

function ChartCard({ title, children, className = "" }) {
  return <Card className={`p-5 ${className}`}><h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">{title}</h3>{children}</Card>;
}

function ReportsPage({ debts, t, dark }) {
  const byCategory = useMemo(() => {
    const map = {};
    debts.forEach((d) => (map[d.category] = (map[d.category] || 0) + debtOutstanding(d)));
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [debts]);
  const byLender = useMemo(() => {
    const map = {};
    debts.forEach((d) => (map[d.lender] = (map[d.lender] || 0) + debtOutstanding(d)));
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [debts]);
  const interestVsPrincipal = [{ name: "Interest Paid", value: t.totalInterestPaid }, { name: "Principal Paid", value: t.totalPrincipalPaid }];
  const timeline = useMemo(() => debts.filter((d) => d.kind === "loan").map((d) => ({ name: d.name.split(" ")[0], months: d.months_remaining })).sort((a, b) => a.months - b.months), [debts]);
  const gridStroke = dark ? "#1e293b" : "#f1f5f9";
  const textColor = dark ? "#94a3b8" : "#64748b";

  if (debts.length === 0) return <Card className="p-16 text-center text-slate-400">Add at least one debt to see reports.</Card>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <ChartCard title="Debt Reduction Over Time (illustrative trend)" className="xl:col-span-2">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={debtReductionSeries}>
            <defs><linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.indigo} stopOpacity={0.35} /><stop offset="100%" stopColor={COLORS.indigo} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={moneyAxis} />
            <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }} />
            <Area type="monotone" dataKey="balance" stroke={COLORS.indigo} strokeWidth={2.5} fill="url(#grad1)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Interest vs Principal Paid">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={interestVsPrincipal} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
              {interestVsPrincipal.map((_, i) => <Cell key={i} fill={i === 0 ? COLORS.rose : COLORS.emerald} />)}
            </Pie>
            <Tooltip formatter={(v) => money(v)} /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Debt by Category">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
              {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => money(v)} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Debt by Lender">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byLender} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
            <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={moneyAxis} />
            <YAxis type="category" dataKey="name" tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
            <Tooltip formatter={(v) => money(v)} />
            <Bar dataKey="value" fill={COLORS.sky} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Monthly Payments (illustrative trend)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyPaymentSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => money(v)} />
            <Bar dataKey="amount" fill={COLORS.indigoSoft} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Cash Flow (illustrative trend)" className="xl:col-span-2">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={cashFlowSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => money(v)} /><Legend />
            <Line type="monotone" dataKey="income" stroke={COLORS.emerald} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="debt" stroke={COLORS.rose} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Debt Payoff Timeline (months remaining)" className="xl:col-span-2">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => `${v} months`} />
            <Bar dataKey="months" fill={COLORS.amber} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

/* ---------------------------------------------------------------
   PAGE: DEBT CALCULATOR
---------------------------------------------------------------- */

function CalculatorPage({ debts }) {
  const baseDebts = useMemo(
    () => debts.map((d) => ({ id: d.id, name: d.name, balance: debtOutstanding(d), rate: debtRate(d), minPayment: debtMonthlyDue(d) })).filter((d) => d.balance > 0),
    [debts]
  );
  const [extra, setExtra] = useState(300);
  const snowball = useMemo(() => simulateStrategy(baseDebts, extra, "snowball"), [baseDebts, extra]);
  const avalanche = useMemo(() => simulateStrategy(baseDebts, extra, "avalanche"), [baseDebts, extra]);
  const noExtra = useMemo(() => simulateStrategy(baseDebts, 0, "avalanche"), [baseDebts]);
  const interestSaved = noExtra.totalInterest - avalanche.totalInterest;
  const payoffDate = (months) => { const d = new Date(); d.setMonth(d.getMonth() + months); return fmtDate(d); };

  if (baseDebts.length === 0) return <Card className="p-16 text-center text-slate-400">Add at least one debt to run the calculator.</Card>;

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Debt Payoff Calculator</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Simulates every current debt at its own rate. Extra payment is allocated by strategy each month; minimums are always paid first.</p>
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Extra Monthly Payment</label>
            <span className="font-display text-lg font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{money(extra)}</span>
          </div>
          <input type="range" min={0} max={2000} step={50} value={extra} onChange={(e) => setExtra(Number(e.target.value))} className="w-full accent-indigo-600" />
          <div className="flex justify-between text-xs text-slate-400 mt-1"><span>$0</span><span>$2,000</span></div>
        </div>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-6 border-indigo-200 dark:border-indigo-900/60">
          <div className="flex items-center gap-2 mb-1"><div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><TrendingDown size={16} /></div><h4 className="font-display font-semibold text-slate-900 dark:text-white">Avalanche Strategy</h4></div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Highest interest rate paid off first — minimizes total interest.</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Debt-free in</span><span className="font-medium text-slate-800 dark:text-slate-100">{avalanche.months} months</span></div>
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Estimated payoff date</span><span className="font-medium text-slate-800 dark:text-slate-100">{payoffDate(avalanche.months)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Total interest paid</span><span className="font-medium text-rose-600 dark:text-rose-400">{money(avalanche.totalInterest)}</span></div>
          </div>
        </Card>
        <Card className="p-6 border-sky-200 dark:border-sky-900/60">
          <div className="flex items-center gap-2 mb-1"><div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400"><Flame size={16} /></div><h4 className="font-display font-semibold text-slate-900 dark:text-white">Snowball Strategy</h4></div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Smallest balance paid off first — builds momentum and quick wins.</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Debt-free in</span><span className="font-medium text-slate-800 dark:text-slate-100">{snowball.months} months</span></div>
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Estimated payoff date</span><span className="font-medium text-slate-800 dark:text-slate-100">{payoffDate(snowball.months)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Total interest paid</span><span className="font-medium text-rose-600 dark:text-rose-400">{money(snowball.totalInterest)}</span></div>
          </div>
        </Card>
      </div>
      <Card className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-none">
        <div className="flex items-center gap-2 mb-1"><CheckCircle2 size={18} /><h4 className="font-display font-semibold">Interest Saved vs. Minimum-Only</h4></div>
        <p className="text-sm text-indigo-100 mb-3">Paying {money(extra)}/mo extra with the avalanche method vs. paying only minimums.</p>
        <p className="font-display text-3xl font-semibold tabular-nums">{money(Math.max(0, interestSaved))}</p>
        <p className="text-xs text-indigo-200 mt-1">Minimum-only path: {noExtra.months} months, {money(noExtra.totalInterest)} interest.</p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   PAGE: LENDERS
---------------------------------------------------------------- */

function LendersPage({ debts }) {
  const lenders = useMemo(() => {
    const map = {};
    debts.forEach((d) => {
      if (!map[d.lender]) map[d.lender] = { name: d.lender, debts: [], total: 0 };
      map[d.lender].debts.push(d);
      map[d.lender].total += debtOutstanding(d);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [debts]);
  if (lenders.length === 0) return <Card className="p-16 text-center text-slate-400">No lenders yet — add a debt to populate this list.</Card>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {lenders.map((l) => (
        <Card key={l.name} className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300"><Building2 size={18} /></div>
            <div><h4 className="font-display font-semibold text-slate-900 dark:text-white">{l.name}</h4><p className="text-xs text-slate-400 dark:text-slate-500">{l.debts.length} account{l.debts.length > 1 ? "s" : ""}</p></div>
            <p className="ml-auto font-display font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{money(l.total)}</p>
          </div>
          <div className="mt-3 space-y-1.5">
            {l.debts.map((d) => (
              <div key={d.id} className="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>{debtLabel(d)}</span><span className="tabular-nums">{money(debtOutstanding(d))}</span></div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   PAGE: DOCUMENTS / SETTINGS
---------------------------------------------------------------- */

function StubPage({ title, note }) {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-4"><FileText size={20} /></div>
      <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">{note}</p>
    </Card>
  );
}

function SettingsPage({ dark, setDark, onExportCsv, onReset, supabaseUrl }) {
  return (
    <div className="space-y-4 max-w-xl">
      <Card className="p-5 flex items-center justify-between">
        <div><h4 className="font-medium text-slate-800 dark:text-slate-100">Dark Mode</h4><p className="text-xs text-slate-400 dark:text-slate-500">Preference isn't stored yet — resets each visit unless you wire it into a `user_preferences` table.</p></div>
        <button onClick={() => setDark(!dark)} className={`h-7 w-12 rounded-full transition-colors relative ${dark ? "bg-indigo-600" : "bg-slate-200"}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${dark ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </Card>
      <Card className="p-5 flex items-center justify-between">
        <div><h4 className="font-medium text-slate-800 dark:text-slate-100">Export Data</h4><p className="text-xs text-slate-400 dark:text-slate-500">Downloads a CSV of all current debts. No PDF/Excel export.</p></div>
        <button onClick={onExportCsv} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500"><Download size={14} /> Export CSV</button>
      </Card>
      <Card className="p-5 flex items-center justify-between">
        <div><h4 className="font-medium text-slate-800 dark:text-slate-100">Wipe All Data</h4><p className="text-xs text-slate-400 dark:text-slate-500">Deletes every debt and payment from your Supabase project. Cannot be undone. Re-run the seed block in schema.sql to restore sample data.</p></div>
        <button onClick={onReset} className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 px-3.5 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 size={14} /> Wipe Data</button>
      </Card>
      <Card className="p-5">
        <h4 className="font-medium text-slate-800 dark:text-slate-100">Connected Project</h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 break-all">{supabaseUrl || "Not configured — check your .env file."}</p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   DETAIL DRAWER + PAYMENT MODAL + ADD DEBT MODAL
---------------------------------------------------------------- */

function DetailDrawer({ debt, history, onClose, onDelete, canEdit }) {
  if (!debt) return null;
  const outstanding = debtOutstanding(debt);
  const original = debtOriginal(debt);
  const debtHistory = history.filter((p) => p.debt_id === debt.id);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-y-auto animate-[slideIn_0.25s_ease-out]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-400 font-medium">{debt.category}</p>
            <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mt-0.5">{debtLabel(debt)}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{debt.lender}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4"><p className="text-xs text-slate-400">Outstanding</p><p className="font-display text-xl font-semibold text-slate-900 dark:text-white tabular-nums">{money(outstanding)}</p></div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4"><p className="text-xs text-slate-400">Original / Limit</p><p className="font-display text-xl font-semibold text-slate-900 dark:text-white tabular-nums">{money(original)}</p></div>
        </div>
        <div className="mt-6"><p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Payoff Progress</p><Runway percent={debtProgress(debt)} tone={debt.kind === "shark" ? "orange" : debt.kind === "card" ? "sky" : "indigo"} /></div>
        <div className="mt-6 space-y-3 text-sm">
          {debt.kind === "loan" && <>
            <Row label="Interest Rate" value={pct(debt.rate)} /><Row label="EMI" value={`${money(debt.emi)}/mo`} />
            <Row label="Months Remaining" value={debt.months_remaining} /><Row label="Next Due Date" value={fmtDate(debt.next_due)} />
            <Row label="Principal Paid" value={money(debt.principal_paid)} /><Row label="Interest Paid" value={money(debt.interest_paid)} />
          </>}
          {debt.kind === "card" && <>
            <Row label="APR" value={pct(debt.apr)} /><Row label="Minimum Due" value={money(debt.min_due)} />
            <Row label="Due Date" value={fmtDate(debt.next_due)} /><Row label="Available Credit" value={money(debt.limit_amount - debt.balance)} />
          </>}
          {debt.kind === "shark" && <>
            <Row label="Monthly Interest" value={pct(debt.monthly_rate)} /><Row label="Next Interest Due" value={fmtDate(debt.next_interest_due)} />
            <Row label="Principal Paid" value={money(debt.principal_paid)} /><Row label="Interest Paid" value={money(debt.interest_paid)} />
          </>}
        </div>
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Payment History</p>
          <div className="space-y-2">
            {debtHistory.map((p) => (
              <div key={p.id} className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">{fmtDate(p.date)}</span><span className="font-medium text-slate-800 dark:text-slate-100 tabular-nums">{money(p.amount)}</span></div>
            ))}
            {debtHistory.length === 0 && <p className="text-sm text-slate-400">No recorded payments yet for this debt.</p>}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { onDelete(debt.id); onClose(); }} className="mt-8 w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <Trash2 size={14} /> Delete This Debt
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{label}</span><span className="font-medium text-slate-800 dark:text-slate-100">{value}</span></div>;
}

function Field({ label, type, value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <input type={type} value={value} required={required} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
    </div>
  );
}

function PaymentModal({ payment, onClose, onSubmit, canEdit }) {
  const [amount, setAmount] = useState("");
  const [pDate, setPDate] = useState(toInputDate(new Date()));
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [lateFee, setLateFee] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (payment) { setAmount(""); setPrincipal(""); setInterest(""); setLateFee(""); setNotes(""); setSubmitted(false); setSaving(false); setPDate(toInputDate(new Date())); }
  }, [payment]);

  if (!payment) return null;
  const { debt, mode } = payment;
  const titleMap = { payment: "Make Payment", interest: "Pay Interest", principal: "Pay Principal" };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const amt = Number(amount) || 0;
    const prin = principal !== "" ? Number(principal) : mode === "interest" ? 0 : amt;
    const inter = interest !== "" ? Number(interest) : mode === "interest" ? amt : 0;
    const ok = await onSubmit(debt, { date: pDate, amount: amt, principal: prin, interest: inter, mode });
    setSaving(false);
    if (ok) setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 animate-[popIn_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{titleMap[mode]}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{debtLabel(debt)} · {debt.lender}</p>
        {submitted ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={36} />
            <p className="font-medium text-slate-800 dark:text-slate-100">Payment saved to Supabase</p>
            <p className="text-sm text-slate-400 mt-1">Balance and progress are updated and will persist across reloads.</p>
            <button onClick={onClose} className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Payment Date" type="date" value={pDate} onChange={setPDate} />
            <Field label="Amount" type="number" value={amount} onChange={setAmount} placeholder="0" required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Principal Paid" type="number" value={principal} onChange={setPrincipal} placeholder="0" />
              <Field label="Interest Paid" type="number" value={interest} onChange={setInterest} placeholder="0" />
            </div>
            <Field label="Late Fee" type="number" value={lateFee} onChange={setLateFee} placeholder="0" />
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Upload Receipt</label>
              <div className="mt-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-4 text-center text-xs text-slate-400">Not wired up. Supabase Storage supports this — add a `receipt_url` column and upload to a bucket if you want it.</div>
            </div>
            {canEdit ? (
              <button type="submit" disabled={saving} className="w-full mt-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Record Payment
              </button>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-400">
                Unlock editing to record payments.
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

const CATEGORY_BY_KIND = { loan: ["Home Loan", "Car Loan", "Personal Loan", "Education Loan"], card: ["Credit Card"], shark: ["Informal Loan"] };

function AddDebtModal({ open, onClose, onAdd, canEdit }) {
  const [kind, setKind] = useState("loan");
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const in14 = new Date();
      in14.setDate(in14.getDate() + 14);
      setForm({ category: CATEGORY_BY_KIND[kind][0], nextDue: toInputDate(in14) });
    }
  }, [open, kind]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    let row;
    if (kind === "loan") {
      const original = Number(form.original) || 0;
      const balance = Number(form.balance) || 0;
      row = {
        kind: "loan", category: form.category, name: form.name || "Untitled Loan", lender: form.lender || "Unknown Lender",
        original, balance, rate: Number(form.rate) || 0, emi: Number(form.emi) || 0, next_due: form.nextDue,
        months_remaining: Number(form.monthsRemaining) || 12, total_months: Number(form.totalMonths) || Number(form.monthsRemaining) || 12,
        principal_paid: Math.max(0, original - balance), interest_paid: 0,
      };
    } else if (kind === "card") {
      row = {
        kind: "card", category: "Credit Card", name: form.name || "Untitled Card", lender: form.lender || "Unknown Bank",
        balance: Number(form.balance) || 0, limit_amount: Number(form.limit) || 0, apr: Number(form.apr) || 0,
        min_due: Number(form.minDue) || 0, next_due: form.nextDue,
      };
    } else {
      const original = Number(form.original) || 0;
      row = {
        kind: "shark", category: "Informal Loan", name: `Loan Shark — ${form.borrower || "Unnamed"}`,
        borrower: form.borrower || "Unnamed", lender: `${form.borrower || "Unnamed"} (Private)`,
        original, principal_remaining: original, monthly_rate: Number(form.monthlyRate) || 0,
        principal_paid: 0, interest_paid: 0, next_interest_due: form.nextDue,
      };
    }
    const result = await onAdd(row);
    setSaving(false);
    if (result) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto animate-[popIn_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Add Debt</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="flex gap-2 mb-5">
          {[{ k: "loan", label: "Bank Loan" }, { k: "card", label: "Credit Card" }, { k: "shark", label: "Informal / Loan Shark" }].map((opt) => (
            <button key={opt.k} type="button" onClick={() => setKind(opt.k)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium border transition-colors ${kind === opt.k ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>{opt.label}</button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {kind === "loan" && (<>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Loan Category</label>
              <select value={form.category || ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                {CATEGORY_BY_KIND.loan.map((c) => <option key={c} value={c} className="dark:bg-slate-900">{c}</option>)}
              </select>
            </div>
            <Field label="Loan Name" type="text" value={form.name || ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Home Loan" required />
            <Field label="Lender" type="text" value={form.lender || ""} onChange={(v) => setForm((f) => ({ ...f, lender: v }))} placeholder="e.g. HDFC Bank" required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Original Amount" type="number" value={form.original || ""} onChange={(v) => setForm((f) => ({ ...f, original: v }))} placeholder="0" required />
              <Field label="Remaining Balance" type="number" value={form.balance || ""} onChange={(v) => setForm((f) => ({ ...f, balance: v }))} placeholder="0" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interest Rate (%)" type="number" value={form.rate || ""} onChange={(v) => setForm((f) => ({ ...f, rate: v }))} placeholder="0" />
              <Field label="EMI" type="number" value={form.emi || ""} onChange={(v) => setForm((f) => ({ ...f, emi: v }))} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Months Remaining" type="number" value={form.monthsRemaining || ""} onChange={(v) => setForm((f) => ({ ...f, monthsRemaining: v }))} placeholder="0" />
              <Field label="Total Term (months)" type="number" value={form.totalMonths || ""} onChange={(v) => setForm((f) => ({ ...f, totalMonths: v }))} placeholder="0" />
            </div>
            <Field label="Next Due Date" type="date" value={form.nextDue || ""} onChange={(v) => setForm((f) => ({ ...f, nextDue: v }))} />
          </>)}
          {kind === "card" && (<>
            <Field label="Card Name" type="text" value={form.name || ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Visa Signature" required />
            <Field label="Bank" type="text" value={form.lender || ""} onChange={(v) => setForm((f) => ({ ...f, lender: v }))} placeholder="e.g. Axis Bank" required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Outstanding Balance" type="number" value={form.balance || ""} onChange={(v) => setForm((f) => ({ ...f, balance: v }))} placeholder="0" required />
              <Field label="Credit Limit" type="number" value={form.limit || ""} onChange={(v) => setForm((f) => ({ ...f, limit: v }))} placeholder="0" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="APR (%)" type="number" value={form.apr || ""} onChange={(v) => setForm((f) => ({ ...f, apr: v }))} placeholder="0" />
              <Field label="Minimum Due" type="number" value={form.minDue || ""} onChange={(v) => setForm((f) => ({ ...f, minDue: v }))} placeholder="0" />
            </div>
            <Field label="Due Date" type="date" value={form.nextDue || ""} onChange={(v) => setForm((f) => ({ ...f, nextDue: v }))} />
          </>)}
          {kind === "shark" && (<>
            <Field label="Borrower / Lender Name" type="text" value={form.borrower || ""} onChange={(v) => setForm((f) => ({ ...f, borrower: v }))} placeholder="e.g. Ramesh" required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Principal" type="number" value={form.original || ""} onChange={(v) => setForm((f) => ({ ...f, original: v }))} placeholder="0" required />
              <Field label="Monthly Interest (%)" type="number" value={form.monthlyRate || ""} onChange={(v) => setForm((f) => ({ ...f, monthlyRate: v }))} placeholder="0" required />
            </div>
            <Field label="Next Interest Due" type="date" value={form.nextDue || ""} onChange={(v) => setForm((f) => ({ ...f, nextDue: v }))} />
          </>)}
          {canEdit ? (
            <button type="submit" disabled={saving} className="w-full mt-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />} Add Debt
            </button>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-400">
              Unlock editing to add debts.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   STATS STRIP
---------------------------------------------------------------- */

function StatsStrip({ debts, t }) {
  if (debts.length === 0) return null;
  const avgRate = debts.reduce((s, d) => s + debtRate(d), 0) / debts.length;
  const highestInterest = [...debts].sort((a, b) => debtRate(b) - debtRate(a))[0];
  const largest = [...debts].sort((a, b) => debtOutstanding(b) - debtOutstanding(a))[0];
  const stats = [
    { label: "Average Interest Rate", value: pct(avgRate) },
    { label: "Highest Interest Debt", value: debtLabel(highestInterest) },
    { label: "Largest Debt", value: debtLabel(largest) },
    { label: "Monthly Commitment", value: money(Math.round(t.monthlyPayment)) },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => <Card key={s.label} className="p-4"><p className="text-xs text-slate-400 dark:text-slate-500">{s.label}</p><p className="mt-1 font-display font-semibold text-slate-800 dark:text-slate-100 truncate">{s.value}</p></Card>)}
    </div>
  );
}

/* ---------------------------------------------------------------
   NAV CONFIG + ROOT APP
---------------------------------------------------------------- */

function SetupScreen() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <CreditCard size={22} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Connect Supabase</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Debtline needs a database before it can load.</p>
          </div>
        </div>
        <ol className="space-y-4 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
          <li>Create a project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">supabase.com</a>.</li>
          <li>In the SQL Editor, run the contents of <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs">supabase/schema.sql</code>.</li>
          <li>Copy <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs">.env.example</code> to <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs">.env</code> and paste your Project URL and anon key from Project Settings → API.</li>
          <li>Restart the dev server (<code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs">npm run dev</code>) so Vite picks up the new env vars.</li>
        </ol>
        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">A <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5">.env</code> file was created from the template — fill in your real values and restart.</p>
      </div>
    </div>
  );
}

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "debts", label: "All Debts", icon: Wallet },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "calendar", label: "Payment Calendar", icon: Calendar },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "calculator", label: "Debt Calculator", icon: Calculator },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "lenders", label: "Lenders", icon: Building2 },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function App() {
  if (!isSupabaseConfigured) return <SetupScreen />;
  return <MainApp />;
}

function MainApp() {
  const { debts, history, loading, error, addDebt, deleteDebt, recordPayment, resetToSample, reload } = useDebts();
  const [page, setPage] = useState("dashboard");
  const [dark, setDark] = useState(false);
  const [detailDebt, setDetailDebt] = useState(null);
  const [payment, setPayment] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [passkeyError, setPasskeyError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(isPasskeyConfigured());

  const t = useMemo(() => computeTotals(debts), [debts]);
  const openPayment = (debt, mode) => {
    if (!canEdit) return;
    setPayment({ debt, mode });
  };

  const openAdd = () => {
    if (!canEdit) return;
    setAddOpen(true);
  };

  const handleExportCsv = () => {
    const header = ["Name", "Lender", "Category", "Outstanding", "Original", "Rate"];
    const rows = debts.map((d) => [debtLabel(d), d.lender, d.category, debtOutstanding(d), debtOriginal(d), debtRate(d)]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "debts_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const pageTitles = { dashboard: "Dashboard", debts: "All Debts", payments: "Payments", calendar: "Payment Calendar", reports: "Reports", calculator: "Debt Calculator", documents: "Documents", lenders: "Lenders", settings: "Settings" };

  const handleUnlock = (e) => {
    e.preventDefault();
    const saved = loadPasskey();
    if (saved && !isPasskeyMatch(passkeyInput, saved)) {
      setPasskeyError("Passkey is incorrect. Use the owner passkey to unlock editing.");
      return;
    }
    const nextPasskey = savePasskey(passkeyInput);
    if (!nextPasskey) {
      setPasskeyError("Please choose a passkey before unlocking editing.");
      return;
    }
    setIsUnlocked(true);
    setPasskeyError("");
    setPasskeyInput("");
  };

  const handleLock = () => {
    clearPasskey();
    setIsUnlocked(false);
    setPasskeyInput("");
    setPasskeyError("");
  };

  const canEdit = isUnlocked;

  return (
    <div className={dark ? "dark" : ""}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes popIn { from { transform: scale(0.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex">
        <aside className={`fixed lg:static z-30 inset-y-0 left-0 w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-100 dark:border-slate-800">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-display font-bold text-sm">D</div>
            <span className="font-display font-semibold text-slate-900 dark:text-white">Debtline</span>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map((n) => (
              <button key={n.key} onClick={() => { setPage(n.key); setMobileNavOpen(false); }} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${page === n.key ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}>
                <n.icon size={17} />{n.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            {canEdit ? (
              <button onClick={openAdd} className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"><Plus size={15} /> Add Debt</button>
            ) : (
              <div className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm text-slate-400 dark:border-slate-700">Unlock editing to add debts</div>
            )}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-500 dark:text-slate-400">
              <p className="font-medium text-slate-700 dark:text-slate-200 mb-1">Debt-Free Progress</p>
              <Runway percent={t.debtFreeProgress} />
              <p className="mt-1.5">{pct(t.debtFreeProgress)} paid off</p>
            </div>
          </div>
        </aside>

        {mobileNavOpen && <div className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden" onClick={() => setMobileNavOpen(false)} />}

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-16 sticky top-0 z-10 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center px-4 lg:px-8 gap-4">
            <button className="lg:hidden text-slate-500" onClick={() => setMobileNavOpen(true)}><LayoutDashboard size={20} /></button>
            <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{pageTitles[page]}</h1>
            <div className="ml-auto flex items-center gap-3">
              <button onClick={reload} title="Refresh from Supabase" className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              </button>
              <button onClick={() => setDark(!dark)} className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
              <div className="h-9 w-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-medium font-display">PK</div>
            </div>
          </header>

          <div className="mx-4 lg:mx-8 mt-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{canEdit ? "Editing unlocked" : "Sharing mode"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{canEdit ? "Only you can add, edit, or delete debts." : "Anyone with the link can view data, but editing stays locked until the owner unlocks it."}</p>
              </div>
              {canEdit ? (
                <button onClick={handleLock} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Lock editing</button>
              ) : (
                <form onSubmit={handleUnlock} className="flex flex-col gap-2 sm:flex-row">
                  <input value={passkeyInput} onChange={(e) => setPasskeyInput(e.target.value)} type="password" placeholder="Owner passkey" className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:text-slate-100" />
                  <button type="submit" className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">Unlock editing</button>
                </form>
              )}
            </div>
            {passkeyError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{passkeyError}</p>}
          </div>

          {error && (
            <div className="mx-4 lg:mx-8 mt-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-900 px-4 py-3 text-sm text-rose-700 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Supabase error: {error}</p>
                <p className="text-xs mt-0.5 opacity-80">Check that .env has the right URL/key and that supabase/schema.sql has been run in your project.</p>
              </div>
            </div>
          )}

          <main className="flex-1 p-4 lg:p-8 max-w-[1400px] w-full mx-auto">
            {loading && debts.length === 0 ? (
              <div className="flex items-center justify-center py-24 text-slate-400 gap-2"><Loader2 className="animate-spin" size={18} /> Loading from Supabase…</div>
            ) : (
              <>
                {page === "dashboard" && <DashboardPage debts={debts} t={t} openDetail={setDetailDebt} openPayment={openPayment} openAdd={openAdd} canEdit={canEdit} />}
                {page === "debts" && (
                  <div className="space-y-5">
                    <StatsStrip debts={debts} t={t} />
                    <AllDebtsPage debts={debts} openDetail={setDetailDebt} openPayment={openPayment} openAdd={openAdd} canEdit={canEdit} />
                  </div>
                )}
                {page === "payments" && <PaymentsPage history={history} />}
                {page === "calendar" && <CalendarPage debts={debts} />}
                {page === "reports" && <ReportsPage debts={debts} t={t} dark={dark} />}
                {page === "calculator" && <CalculatorPage debts={debts} />}
                {page === "documents" && <StubPage title="Documents" note="No file storage is wired up yet. Supabase Storage (free tier: 1 GB) can hold receipts and loan agreements — add a bucket and a `documents` table with a `debt_id` foreign key if you want this built out." />}
                {page === "lenders" && <LendersPage debts={debts} />}
                {page === "settings" && <SettingsPage dark={dark} setDark={setDark} onExportCsv={handleExportCsv} onReset={resetToSample} supabaseUrl={import.meta.env.VITE_SUPABASE_URL} />}
              </>
            )}
          </main>
        </div>
      </div>

      <DetailDrawer debt={detailDebt} history={history} onClose={() => setDetailDebt(null)} onDelete={deleteDebt} canEdit={canEdit} />
      <PaymentModal payment={payment} onClose={() => setPayment(null)} onSubmit={recordPayment} canEdit={canEdit} />
      <AddDebtModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={addDebt} canEdit={canEdit} />
    </div>
  );
}
