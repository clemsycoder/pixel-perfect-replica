import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIN_TRADE_QUANTITY, MAX_TRADE_QUANTITY } from "./fees";

// ---------- Types ----------

export interface HoldingDTO {
  commodityId: string;
  slug: string;
  name: string;
  unit: string;
  quantity: number;
  avgCostKobo: number;
  currentPriceKobo: number | null;
  marketValueKobo: number | null;
  costKobo: number;
  pnlKobo: number | null;
  pnlPct: number | null;
  priceRecordedAt: string | null;
}

export interface TradeDTO {
  id: string;
  commodityId: string;
  commodityName: string;
  commoditySlug: string;
  side: "buy" | "sell";
  quantity: number;
  pricePerUnitKobo: number;
  feeKobo: number;
  totalKobo: number;
  createdAt: string;
}

export interface LedgerEntryDTO {
  id: string;
  entryType: string;
  direction: "credit" | "debit";
  amountKobo: number;
  balanceAfterKobo: number;
  reference: string;
  description: string | null;
  createdAt: string;
}

export interface WatchlistItemDTO {
  id: string;
  commodityId: string;
  slug: string;
  name: string;
  unit: string;
  latestPriceKobo: number | null;
  changePct: number | null;
}

export interface AlertDTO {
  id: string;
  commodityId: string;
  commodityName: string;
  direction: "above" | "below";
  targetPriceKobo: number;
  status: "active" | "triggered" | "cancelled";
  createdAt: string;
  triggeredAt: string | null;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PortfolioDTO {
  holdings: HoldingDTO[];
  totals: {
    marketValueKobo: number;
    costKobo: number;
    pnlKobo: number;
    pnlPct: number | null;
    pricedHoldings: number;
  };
}

// ---------- Portfolio ----------

export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortfolioDTO> => {
    const { supabase, userId } = context;
    const holdingsRes = await supabase
      .from("holdings")
      .select(
        "commodity_id, quantity, avg_cost_kobo, commodities (slug, name, unit)",
      )
      .gt("quantity", 0)
      .order("updated_at", { ascending: false });
    if (holdingsRes.error) throw new Error("Failed to load your holdings");

    const rows = holdingsRes.data.filter((h) => h.commodities);
    const commodityIds = [...new Set(rows.map((h) => h.commodity_id))];

    const latest = new Map<string, { priceKobo: number; recordedAt: string }>();
    await Promise.all(
      commodityIds.map(async (cid) => {
        const res = await supabase
          .from("market_prices")
          .select("price, recorded_at")
          .eq("commodity_id", cid)
          .order("recorded_at", { ascending: false })
          .limit(1);
        const row = res.data?.[0];
        if (row) {
          latest.set(cid, { priceKobo: Math.round(Number(row.price) * 100), recordedAt: row.recorded_at });
        }
      }),
    );

    const holdings: HoldingDTO[] = rows.map((h) => {
      const c = h.commodities as { slug: string; name: string; unit: string };
      const quantity = Number(h.quantity);
      const avgCostKobo = Number(h.avg_cost_kobo);
      const price = latest.get(h.commodity_id) ?? null;
      const marketValueKobo = price ? Math.round(price.priceKobo * quantity) : null;
      const costKobo = Math.round(avgCostKobo * quantity);
      const pnlKobo = marketValueKobo !== null ? marketValueKobo - costKobo : null;
      const pnlPct =
        pnlKobo !== null && costKobo > 0 ? (pnlKobo / costKobo) * 100 : null;
      return {
        commodityId: h.commodity_id,
        slug: c.slug,
        name: c.name,
        unit: c.unit,
        quantity,
        avgCostKobo,
        currentPriceKobo: price?.priceKobo ?? null,
        marketValueKobo,
        costKobo,
        pnlKobo,
        pnlPct,
        priceRecordedAt: price?.recordedAt ?? null,
      };
    });

    const priced = holdings.filter((h) => h.marketValueKobo !== null);
    const marketValueKobo = priced.reduce((s, h) => s + (h.marketValueKobo ?? 0), 0);
    const costKobo = holdings.reduce((s, h) => s + h.costKobo, 0);
    const pnlKobo = marketValueKobo - costKobo;
    return {
      holdings,
      totals: {
        marketValueKobo,
        costKobo,
        pnlKobo,
        pnlPct: costKobo > 0 && priced.length > 0 ? (pnlKobo / costKobo) * 100 : null,
        pricedHoldings: priced.length,
      },
    };
  });

// ---------- Trades & ledger ----------

export const getTradeHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TradeDTO[]> => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("trades")
      .select("id, commodity_id, side, quantity, price_per_unit_kobo, fee_kobo, total_kobo, created_at, commodities (name, slug)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (res.error) throw new Error("Failed to load your trades");
    return res.data.map((t) => {
      const c = t.commodities as { name: string; slug: string } | null;
      return {
        id: t.id,
        commodityId: t.commodity_id,
        commodityName: c?.name ?? "—",
        commoditySlug: c?.slug ?? "",
        side: t.side as "buy" | "sell",
        quantity: Number(t.quantity),
        pricePerUnitKobo: Number(t.price_per_unit_kobo),
        feeKobo: t.fee_kobo,
        totalKobo: t.total_kobo,
        createdAt: t.created_at,
      };
    });
  });

export const getLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LedgerEntryDTO[]> => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("wallet_ledger")
      .select("id, entry_type, direction, amount_kobo, balance_after_kobo, reference, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (res.error) throw new Error("Failed to load your activity");
    return res.data.map((l) => ({
      id: l.id,
      entryType: l.entry_type,
      direction: l.direction as "credit" | "debit",
      amountKobo: l.amount_kobo,
      balanceAfterKobo: l.balance_after_kobo,
      reference: l.reference,
      description: l.description,
      createdAt: l.created_at,
    }));
  });

// ---------- Execute trade ----------

export const executeTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { commodityId: string; side: "buy" | "sell"; quantity: number }) => {
    if (!input?.commodityId) throw new Error("Choose a commodity first");
    if (input.side !== "buy" && input.side !== "sell") throw new Error("Invalid trade side");
    const qty = Number(input.quantity);
    if (!Number.isFinite(qty) || qty < MIN_TRADE_QUANTITY) {
      throw new Error(`Minimum quantity is ${MIN_TRADE_QUANTITY}`);
    }
    if (qty > MAX_TRADE_QUANTITY) throw new Error("Quantity is too large");
    return { commodityId: input.commodityId, side: input.side, quantity: qty };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("execute_trade", {
      p_commodity_id: data.commodityId,
      p_side: data.side,
      p_quantity: data.quantity,
    });
    if (error) throw new Error(error.message);
    return result as {
      trade_id: string;
      side: string;
      quantity: number;
      price_per_unit_kobo: number;
      gross_kobo: number;
      fee_kobo: number;
      total_kobo: number;
      balance_after_kobo: number;
      holding_quantity: number;
      avg_cost_kobo: number;
    };
  });

// ---------- Watchlist ----------

export const getWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WatchlistItemDTO[]> => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("watchlist")
      .select("id, commodity_id, commodities (slug, name, unit)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (res.error) throw new Error("Failed to load your watchlist");

    const items = res.data.filter((w) => w.commodities);
    const latest = new Map<string, { priceKobo: number; changePct: number | null }>();
    await Promise.all(
      items.map(async (w) => {
        const pr = await supabase
          .from("market_prices")
          .select("price, recorded_at")
          .eq("commodity_id", w.commodity_id)
          .order("recorded_at", { ascending: false })
          .limit(2);
        const rows = pr.data ?? [];
        const cur = rows[0] ? Math.round(Number(rows[0].price) * 100) : null;
        const prev = rows[1] ? Number(rows[1].price) * 100 : null;
        latest.set(w.commodity_id, {
          priceKobo: cur ?? 0,
          changePct: cur !== null && prev ? ((cur - prev) / prev) * 100 : null,
        });
      }),
    );

    return items.map((w) => {
      const c = w.commodities as { slug: string; name: string; unit: string };
      const p = latest.get(w.commodity_id);
      return {
        id: w.id,
        commodityId: w.commodity_id,
        slug: c.slug,
        name: c.name,
        unit: c.unit,
        latestPriceKobo: p?.priceKobo || null,
        changePct: p?.changePct ?? null,
      };
    });
  });

export const toggleWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { commodityId: string }) => {
    if (!input?.commodityId) throw new Error("Missing commodity");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", userId)
      .eq("commodity_id", data.commodityId)
      .maybeSingle();
    if (existing.data) {
      const { error } = await supabase.from("watchlist").delete().eq("id", existing.data.id);
      if (error) throw new Error("Could not update your watchlist");
      return { watching: false };
    }
    const { error } = await supabase
      .from("watchlist")
      .insert({ user_id: userId, commodity_id: data.commodityId });
    if (error) throw new Error("Could not update your watchlist");
    return { watching: true };
  });

// ---------- Price alerts ----------

export const getAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AlertDTO[]> => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("price_alerts")
      .select("id, commodity_id, direction, target_price_kobo, status, created_at, triggered_at, commodities (name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (res.error) throw new Error("Failed to load your alerts");
    return res.data.map((a) => {
      const c = a.commodities as { name: string } | null;
      return {
        id: a.id,
        commodityId: a.commodity_id,
        commodityName: c?.name ?? "—",
        direction: a.direction as "above" | "below",
        targetPriceKobo: a.target_price_kobo,
        status: a.status as "active" | "triggered" | "cancelled",
        createdAt: a.created_at,
        triggeredAt: a.triggered_at,
      };
    });
  });

export const createAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { commodityId: string; direction: "above" | "below"; targetPriceKobo: number }) => {
    if (!input?.commodityId) throw new Error("Choose a commodity");
    if (input.direction !== "above" && input.direction !== "below") throw new Error("Invalid alert direction");
    const target = Math.round(Number(input.targetPriceKobo));
    if (!Number.isFinite(target) || target <= 0) throw new Error("Set a target price");
    return { commodityId: input.commodityId, direction: input.direction, targetPriceKobo: target };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("price_alerts").insert({
      user_id: userId,
      commodity_id: data.commodityId,
      direction: data.direction,
      target_price_kobo: data.targetPriceKobo,
    });
    if (error) throw new Error("Could not create the alert");
    return { ok: true };
  });

export const cancelAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { alertId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("price_alerts")
      .update({ status: "cancelled" })
      .eq("id", data.alertId)
      .eq("user_id", userId);
    if (error) throw new Error("Could not cancel the alert");
    return { ok: true };
  });

// ---------- Notifications ----------

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: NotificationDTO[]; unread: number }> => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("notifications")
      .select("id, type, title, body, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (res.error) throw new Error("Failed to load notifications");
    const items: NotificationDTO[] = res.data.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.is_read,
      createdAt: n.created_at,
    }));
    return { items, unread: items.filter((n) => !n.isRead).length };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw new Error("Could not update notifications");
    return { ok: true };
  });
