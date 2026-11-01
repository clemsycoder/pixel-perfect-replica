// Lumora money/format helpers. Wallet amounts are stored as integer kobo.

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function formatNaira(kobo: number, opts?: { compact?: boolean; noSymbol?: boolean }): string {
  const naira = koboToNaira(kobo);
  if (opts?.compact && Math.abs(naira) >= 1_000_000) {
    return `${opts.noSymbol ? "" : "₦"}${formatCompact(naira)}`;
  }
  const formatted = naira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${opts?.noSymbol ? "" : "₦"}${formatted}`;
}

export function formatCompact(naira: number): string {
  const abs = Math.abs(naira);
  const sign = naira < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${trimNum(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}${trimNum(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trimNum(abs / 1_000)}K`;
  return `${sign}${trimNum(abs)}`;
}

function trimNum(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function formatQuantity(qty: number): string {
  if (qty >= 1000) return qty.toLocaleString("en-NG", { maximumFractionDigits: 1 });
  return qty.toLocaleString("en-NG", { maximumFractionDigits: 4 });
}

export function formatPct(pct: number | null | undefined, opts?: { signed?: boolean }): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "—";
  const sign = opts?.signed && pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(
    "en-NG",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

export function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function titleCase(s: string): string {
  return s
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
