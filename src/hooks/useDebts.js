import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

export function useDebts() {
  const [debts, setDebts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [debtsRes, paymentsRes] = await Promise.all([
      supabase.from("debts").select("*").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("date", { ascending: true }),
    ]);
    if (debtsRes.error) setError(debtsRes.error.message);
    if (paymentsRes.error) setError((e) => e || paymentsRes.error.message);
    setDebts(debtsRes.data || []);
    setHistory(paymentsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addDebt = async (debt) => {
    const { data, error } = await supabase.from("debts").insert(debt).select().single();
    if (error) {
      setError(error.message);
      return null;
    }
    setDebts((prev) => [data, ...prev]);
    return data;
  };

  const deleteDebt = async (id) => {
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setDebts((prev) => prev.filter((d) => d.id !== id));
    setHistory((prev) => prev.filter((p) => p.debt_id !== id));
  };

  // Recomputes the affected debt's fields and writes both the updated
  // debt row and a new payment row. Two writes, not a transaction —
  // Supabase's JS client doesn't expose multi-statement transactions
  // directly, so on a real failure between the two calls you could see
  // a payment logged without the debt balance moving. Fine for a
  // personal single-user app; if that matters to you, move this into a
  // Postgres function (RPC) instead.
  const recordPayment = async (debt, { date, amount, principal, interest, mode }) => {
    let updateFields = {};
    if (debt.kind === "loan") {
      updateFields = {
        balance: Math.max(0, (debt.balance || 0) - principal),
        principal_paid: (debt.principal_paid || 0) + principal,
        interest_paid: (debt.interest_paid || 0) + interest,
        months_remaining: Math.max(0, (debt.months_remaining || 0) - 1),
        next_due: addDays(30),
      };
    } else if (debt.kind === "card") {
      updateFields = {
        balance: Math.max(0, (debt.balance || 0) - (principal || amount)),
        next_due: addDays(30),
      };
    } else {
      // shark
      if (mode === "principal") {
        updateFields = {
          principal_remaining: Math.max(0, (debt.principal_remaining || 0) - (principal || amount)),
          principal_paid: (debt.principal_paid || 0) + (principal || amount),
          next_interest_due: addDays(30),
        };
      } else {
        updateFields = {
          interest_paid: (debt.interest_paid || 0) + (interest || amount),
          next_interest_due: addDays(30),
        };
      }
    }

    const { data: updatedDebt, error: updateError } = await supabase
      .from("debts")
      .update(updateFields)
      .eq("id", debt.id)
      .select()
      .single();
    if (updateError) {
      setError(updateError.message);
      return false;
    }

    const paymentRow = {
      debt_id: debt.id,
      debt_name: debt.name,
      date,
      amount,
      principal,
      interest,
      type: mode === "interest" ? "Interest" : mode === "principal" ? "Principal" : "Payment",
    };
    const { data: newPayment, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentRow)
      .select()
      .single();
    if (paymentError) {
      setError(paymentError.message);
      return false;
    }

    setDebts((prev) => prev.map((d) => (d.id === debt.id ? updatedDebt : d)));
    setHistory((prev) => [...prev, newPayment]);
    return true;
  };

  const resetToSample = async () => {
    setLoading(true);
    await supabase.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("debts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // No seed RPC is set up by default — reset just clears the tables.
    // Re-run supabase/schema.sql's seed block manually if you want the
    // sample debts back.
    await loadAll();
  };

  return { debts, history, loading, error, addDebt, deleteDebt, recordPayment, resetToSample, reload: loadAll };
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
