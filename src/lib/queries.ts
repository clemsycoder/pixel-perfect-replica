import { queryOptions } from "@tanstack/react-query";
import { getMarketData } from "./market.functions";
import { getWallet } from "./wallet.functions";
import {
  getAlerts,
  getLedger,
  getNotifications,
  getPortfolio,
  getTradeHistory,
  getWatchlist,
} from "./trading.functions";
import { getMyProfile } from "./session.functions";

export const marketQuery = () =>
  queryOptions({ queryKey: ["market"], queryFn: () => getMarketData(), staleTime: 60_000 });

export const walletQuery = () =>
  queryOptions({ queryKey: ["wallet"], queryFn: () => getWallet() });

export const portfolioQuery = () =>
  queryOptions({ queryKey: ["portfolio"], queryFn: () => getPortfolio() });

export const tradesQuery = () =>
  queryOptions({ queryKey: ["trades"], queryFn: () => getTradeHistory() });

export const ledgerQuery = () =>
  queryOptions({ queryKey: ["ledger"], queryFn: () => getLedger() });

export const watchlistQuery = () =>
  queryOptions({ queryKey: ["watchlist"], queryFn: () => getWatchlist() });

export const alertsQuery = () =>
  queryOptions({ queryKey: ["alerts"], queryFn: () => getAlerts() });

export const notificationsQuery = () =>
  queryOptions({ queryKey: ["notifications"], queryFn: () => getNotifications() });

export const profileQuery = () =>
  queryOptions({ queryKey: ["profile"], queryFn: () => getMyProfile() });
