# Lumora — Build Roadmap

Source spec: user-uploads://LUMORA_-_BUILD_THE_COMPLETE_AGRICULTURAL_TRADING_pasted.md
Decisions: dark-first design from spec palette (no screenshot provided — build from spec), Flutterwave for wallet funding, NGN base currency, TanStack Start stack (spec asked for Next.js; platform stack is TanStack Start + Lovable Cloud).

## Tasks
- [x] Enable Lovable Cloud
- [ ] Database: profiles, user_roles, commodities, market_prices, wallets, wallet_ledger, holdings, trades, deposits, withdrawals, physical_requests, watchlist, price_alerts, notifications — RLS + grants + seed commodities & reference market data
- [ ] Design system in src/styles.css (exact spec palette, dark default + light mode)
- [ ] Auth: enable email auth, /auth sign-in/sign-up, reset-password, _authenticated layout, admin role check
- [ ] Market data: research real Nigerian commodity price sources, provider-adapter, seed real reference prices with source/unit/location/timestamp
- [ ] Server functions: trading engine (buy/sell with fees, atomic), wallet ops (deposit/withdraw ledger), physical requests, watchlist, alerts, notifications
- [ ] Flutterwave: init payment, server-side verification webhook (needs user's secret key + webhook hash), idempotent wallet credit
- [ ] Generate image library (hero, 10 commodities, seedling promo, physical produce promo)
- [ ] Dashboard page (sidebar, topnav, hero, ticker cards, portfolio chart, wallet card, allocation donut, holdings, activity, promo)
- [ ] Pages: markets, trade terminal, portfolio, wallet, watchlist, transactions, physical requests, settings
- [ ] Framer Motion animations
- [ ] Responsive tablet + mobile adaptations
- [ ] Tests for trading/wallet rules; Playwright end-to-end verification
