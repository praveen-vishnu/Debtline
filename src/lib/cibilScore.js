export const CIBIL_SCORE_STORAGE_KEY = "debtline-cibil-score";

export function readStoredCibilScore() {
  if (typeof window === "undefined") return "";
  const value = window.localStorage.getItem(CIBIL_SCORE_STORAGE_KEY);
  return value ? value.trim() : "";
}

export function writeStoredCibilScore(value) {
  if (typeof window === "undefined") return "";
  const normalized = String(value ?? "").trim();
  window.localStorage.setItem(CIBIL_SCORE_STORAGE_KEY, normalized);
  return normalized;
}
