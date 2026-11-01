import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Public, read-only market data. Runs during SSR and in the browser, so it
// uses a publishable-key client with no session and anon-only reads.
function createPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export interface PricePointDTO {
  price: number; // NGN per unit
  currency: string;
  unit: string;
  location: string;
  source: string;
  sourceKind: string;
  recordedAt: string;
}

export interface CommodityDTO {
  id: string;
  slug: string;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  latest: PricePointDTO | null;
  previous: PricePointDTO | null;
  changePct: number | null;
  history: PricePointDTO[]; // ascending by recordedAt
}

export interface MarketDataDTO {
  commodities: CommodityDTO[];
  asOf: string;
}

export const getMarketData = createServerFn({ method: "GET" }).handler(async (): Promise<MarketDataDTO> => {
  const supabase = createPublicClient();

  const [commoditiesRes, pricesRes] = await Promise.all([
    supabase
      .from("commodities")
      .select("id, slug, name, category, unit, description, image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("market_prices")
      .select("commodity_id, price, currency, unit, market_location, source, source_kind, recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(5000),
  ]);

  if (commoditiesRes.error) throw new Error("Failed to load commodities");
  if (pricesRes.error) throw new Error("Failed to load market prices");

  const pricesByCommodity = new Map<string, PricePointDTO[]>();
  for (const row of pricesRes.data) {
    const list = pricesByCommodity.get(row.commodity_id) ?? [];
    list.push({
      price: Number(row.price),
      currency: row.currency,
      unit: row.unit,
      location: row.market_location,
      source: row.source,
      sourceKind: row.source_kind,
      recordedAt: row.recorded_at,
    });
    pricesByCommodity.set(row.commodity_id, list);
  }

  const commodities: CommodityDTO[] = commoditiesRes.data.map((c) => {
    const descending = pricesByCommodity.get(c.id) ?? [];
    const ascending = [...descending].reverse();
    const latest = descending[0] ?? null;
    const previous = descending[1] ?? null;
    const changePct =
      latest && previous && previous.price > 0 ? ((latest.price - previous.price) / previous.price) * 100 : null;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      category: c.category,
      unit: c.unit,
      description: c.description,
      imageUrl: c.image_url,
      sortOrder: c.sort_order,
      latest,
      previous,
      changePct,
      history: ascending.slice(-90),
    };
  });

  return { commodities, asOf: new Date().toISOString() };
});

export const getCommodityBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<CommodityDTO | null> => {
    const { commodities } = await getMarketData();
    return commodities.find((c) => c.slug === data.slug) ?? null;
  });
