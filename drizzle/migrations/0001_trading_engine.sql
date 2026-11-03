-- ============ Lumora trading engine (server-side money movement) ============
-- All amounts in kobo. Trades price off the latest market_prices observation.

create or replace function public.platform_setting(p_key text)
returns text
language sql
stable
set search_path = public
as $$
  select value from public.platform_settings where key = p_key
$$;

-- Execute an atomic buy or sell against the wallet and holdings.
create or replace function public.execute_trade(
  p_commodity_id uuid,
  p_side text,
  p_quantity numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_price numeric(20,4);
  v_price_kobo bigint;
  v_fee_bps integer;
  v_gross bigint;
  v_fee bigint;
  v_wallet record;
  v_qty numeric(20,6);
  v_avg numeric(20,4);
  v_trade_id uuid;
  v_balance bigint;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_side not in ('buy','sell') then
    raise exception 'Invalid trade side';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_quantity > 1000000 then
    raise exception 'Quantity exceeds the maximum allowed';
  end if;

  -- Price off the latest verified observation (never trust a client price).
  select price into v_price
  from public.market_prices
  where commodity_id = p_commodity_id
  order by recorded_at desc
  limit 1;
  if v_price is null then
    raise exception 'No market price available for this commodity yet';
  end if;
  v_price_kobo := round(v_price * 100);
  if v_price_kobo <= 0 then
    raise exception 'Invalid market price';
  end if;

  v_fee_bps := coalesce(public.platform_setting('trade_fee_bps')::integer, 50);
  v_gross := round(v_price_kobo * p_quantity);
  v_fee := greatest(0, round(v_gross * v_fee_bps / 10000.0));

  if not exists (select 1 from public.commodities where id = p_commodity_id and is_active) then
    raise exception 'Commodity not available';
  end if;

  select * into v_wallet from public.wallets where user_id = v_user for update;
  if not found then
    raise exception 'Wallet not found';
  end if;

  if p_side = 'buy' then
    if v_wallet.balance_kobo < v_gross + v_fee then
      raise exception 'Insufficient wallet balance for this trade';
    end if;

    insert into public.trades (user_id, commodity_id, side, quantity, price_per_unit_kobo, fee_kobo, total_kobo)
    values (v_user, p_commodity_id, 'buy', p_quantity, v_price_kobo, v_fee, v_gross)
    returning id into v_trade_id;

    update public.wallets
    set balance_kobo = balance_kobo - (v_gross + v_fee), updated_at = now()
    where id = v_wallet.id
    returning balance_kobo into v_balance;

    insert into public.wallet_ledger (user_id, entry_type, direction, amount_kobo, balance_after_kobo, reference, description, trade_id)
    values
      (v_user, 'trade_buy', 'debit', v_gross, v_balance - v_fee,
       'trade:' || v_trade_id, format('Bought %s at %s/unit', p_quantity, v_price_kobo), v_trade_id),
      (v_user, 'fee', 'debit', v_fee, v_balance,
       'trade:' || v_trade_id, 'Trade fee', v_trade_id);

    insert into public.holdings (user_id, commodity_id, quantity, avg_cost_kobo)
    values (v_user, p_commodity_id, p_quantity, v_gross / p_quantity)
    on conflict (user_id, commodity_id) do update
    set quantity = public.holdings.quantity + excluded.quantity,
        avg_cost_kobo = round(
          (public.holdings.avg_cost_kobo * public.holdings.quantity + v_gross)
          / (public.holdings.quantity + excluded.quantity), 4),
        updated_at = now()
    returning quantity, avg_cost_kobo into v_qty, v_avg;

    insert into public.notifications (user_id, type, title, body)
    values (v_user, 'trade', 'Trade completed',
      format('Bought %s units at ₦%s per unit (fee ₦%s).', p_quantity, v_price_kobo / 100.0, v_fee / 100.0));

    return jsonb_build_object(
      'trade_id', v_trade_id, 'side', 'buy', 'quantity', p_quantity,
      'price_per_unit_kobo', v_price_kobo, 'gross_kobo', v_gross,
      'fee_kobo', v_fee, 'total_kobo', v_gross + v_fee,
      'balance_after_kobo', v_balance, 'holding_quantity', v_qty, 'avg_cost_kobo', v_avg);

  else -- sell
    select quantity, avg_cost_kobo into v_qty, v_avg
    from public.holdings
    where user_id = v_user and commodity_id = p_commodity_id
    for update;
    if not found or v_qty < p_quantity then
      raise exception 'You do not hold enough of this commodity to sell';
    end if;

    insert into public.trades (user_id, commodity_id, side, quantity, price_per_unit_kobo, fee_kobo, total_kobo)
    values (v_user, p_commodity_id, 'sell', p_quantity, v_price_kobo, v_fee, v_gross)
    returning id into v_trade_id;

    update public.wallets
    set balance_kobo = balance_kobo + (v_gross - v_fee), updated_at = now()
    where id = v_wallet.id
    returning balance_kobo into v_balance;

    insert into public.wallet_ledger (user_id, entry_type, direction, amount_kobo, balance_after_kobo, reference, description, trade_id)
    values
      (v_user, 'trade_sell', 'credit', v_gross - v_fee, v_balance,
       'trade:' || v_trade_id, format('Sold %s at %s/unit (net of fee)', p_quantity, v_price_kobo), v_trade_id),
      (v_user, 'fee', 'debit', v_fee, v_balance,
       'trade:' || v_trade_id, 'Trade fee', v_trade_id);

    update public.holdings
    set quantity = quantity - p_quantity,
        avg_cost_kobo = case when quantity - p_quantity <= 0 then 0 else avg_cost_kobo end,
        updated_at = now()
    where user_id = v_user and commodity_id = p_commodity_id;

    insert into public.notifications (user_id, type, title, body)
    values (v_user, 'trade', 'Trade completed',
      format('Sold %s units at ₦%s per unit (fee ₦%s).', p_quantity, v_price_kobo / 100.0, v_fee / 100.0));

    return jsonb_build_object(
      'trade_id', v_trade_id, 'side', 'sell', 'quantity', p_quantity,
      'price_per_unit_kobo', v_price_kobo, 'gross_kobo', v_gross,
      'fee_kobo', v_fee, 'total_kobo', v_gross,
      'balance_after_kobo', v_balance, 'holding_quantity', v_qty - p_quantity, 'avg_cost_kobo', v_avg);
  end if;
end;
$$;

-- Request a withdrawal: debits the wallet immediately, records a pending payout.
create or replace function public.request_withdrawal(
  p_amount_kobo bigint,
  p_destination_name text,
  p_destination_bank text,
  p_destination_account text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_fee_bps integer;
  v_fee_min bigint;
  v_fee bigint;
  v_balance bigint;
  v_withdrawal_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount_kobo is null or p_amount_kobo < 10000 then
    raise exception 'Minimum withdrawal is ₦100';
  end if;
  if p_destination_name is null or length(trim(p_destination_name)) < 3
     or p_destination_bank is null or length(trim(p_destination_bank)) < 2
     or p_destination_account is null or not (p_destination_account ~ '^[0-9]{10}$') then
    raise exception 'Provide a valid Nigerian bank account (10-digit number)';
  end if;

  v_fee_bps := coalesce(public.platform_setting('withdrawal_fee_bps')::integer, 100);
  v_fee_min := coalesce(public.platform_setting('withdrawal_fee_min_kobo')::bigint, 10000);
  v_fee := greatest(round(p_amount_kobo * v_fee_bps / 10000.0), v_fee_min);

  select * into v_balance from public.wallets where user_id = v_user for update;
  if not found then
    raise exception 'Wallet not found';
  end if;
  if v_balance < p_amount_kobo then
    raise exception 'Insufficient wallet balance';
  end if;

  insert into public.withdrawals (user_id, amount_kobo, fee_kobo, destination_name, destination_bank, destination_account)
  values (v_user, p_amount_kobo, v_fee, trim(p_destination_name), trim(p_destination_bank), trim(p_destination_account))
  returning id into v_withdrawal_id;

  update public.wallets
  set balance_kobo = balance_kobo - p_amount_kobo, updated_at = now()
  where user_id = v_user
  returning balance_kobo into v_balance;

  insert into public.wallet_ledger (user_id, entry_type, direction, amount_kobo, balance_after_kobo, reference, description)
  values (v_user, 'withdrawal', 'debit', p_amount_kobo, v_balance,
          'withdrawal:' || v_withdrawal_id,
          format('Withdrawal to %s (fee ₦%s)', trim(p_destination_bank), v_fee / 100.0));

  insert into public.notifications (user_id, type, title, body)
  values (v_user, 'withdrawal', 'Withdrawal requested',
          format('₦%s withdrawal to %s is being processed.', p_amount_kobo / 100.0, trim(p_destination_bank)));

  return jsonb_build_object('withdrawal_id', v_withdrawal_id, 'fee_kobo', v_fee,
                            'amount_kobo', p_amount_kobo, 'balance_after_kobo', v_balance);
end;
$$;

-- Mark a deposit successful and credit the wallet (Flutterwave webhook only).
create or replace function public.complete_deposit(
  p_tx_ref text,
  p_provider_ref text,
  p_amount_kobo bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deposit record;
  v_balance bigint;
begin
  select * into v_deposit from public.deposits where tx_ref = p_tx_ref for update;
  if not found then
    raise exception 'Unknown deposit reference';
  end if;
  if v_deposit.status = 'successful' then
    return jsonb_build_object('already_processed', true);
  end if;
  if v_deposit.status <> 'pending' then
    raise exception 'Deposit is not in a creditable state';
  end if;
  if p_amount_kobo <> v_deposit.amount_kobo then
    update public.deposits
    set status = 'failed', provider_ref = p_provider_ref, updated_at = now()
    where id = v_deposit.id;
    raise exception 'Deposit amount mismatch';
  end if;

  update public.deposits
  set status = 'successful', provider_ref = p_provider_ref, updated_at = now()
  where id = v_deposit.id;

  select * into v_balance from public.wallets where user_id = v_deposit.user_id for update;
  update public.wallets
  set balance_kobo = balance_kobo + p_amount_kobo, updated_at = now()
  where user_id = v_deposit.user_id
  returning balance_kobo into v_balance;

  insert into public.wallet_ledger (user_id, entry_type, direction, amount_kobo, balance_after_kobo, reference, description)
  values (v_deposit.user_id, 'deposit', 'credit', p_amount_kobo, v_balance,
          'deposit:' || v_deposit.id, 'Wallet funding');

  insert into public.notifications (user_id, type, title, body)
  values (v_deposit.user_id, 'deposit', 'Wallet funded',
          format('₦%s was added to your wallet.', p_amount_kobo / 100.0));

  return jsonb_build_object('credited_kobo', p_amount_kobo, 'balance_after_kobo', v_balance);
end;
$$;

-- Refund a failed withdrawal back to the wallet (admin action only).
create or replace function public.refund_withdrawal(p_withdrawal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w record;
  v_balance bigint;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admins only';
  end if;
  select * into v_w from public.withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Withdrawal not found';
  end if;
  if v_w.status <> 'pending' and v_w.status <> 'processing' then
    raise exception 'Withdrawal cannot be refunded in its current state';
  end if;

  update public.withdrawals
  set status = 'failed', updated_at = now()
  where id = p_withdrawal_id;

  select * into v_balance from public.wallets where user_id = v_w.user_id for update;
  update public.wallets
  set balance_kobo = balance_kobo + v_w.amount_kobo, updated_at = now()
  where user_id = v_w.user_id
  returning balance_kobo into v_balance;

  insert into public.wallet_ledger (user_id, entry_type, direction, amount_kobo, balance_after_kobo, reference, description)
  values (v_w.user_id, 'refund', 'credit', v_w.amount_kobo, v_balance,
          'withdrawal:' || p_withdrawal_id, 'Withdrawal failed — amount returned');

  insert into public.notifications (user_id, type, title, body)
  values (v_w.user_id, 'withdrawal', 'Withdrawal failed', 'Your withdrawal could not be completed and the amount was returned to your wallet.');

  return jsonb_build_object('refunded_kobo', v_w.amount_kobo, 'balance_after_kobo', v_balance);
end;
$$;

-- Functions are executable by PUBLIC by default; lock them down.
revoke execute on function public.execute_trade(uuid, text, numeric) from public, anon;
revoke execute on function public.request_withdrawal(bigint, text, text, text) from public, anon;
revoke execute on function public.complete_deposit(text, text, bigint) from public, anon, authenticated;
revoke execute on function public.refund_withdrawal(uuid) from public, anon, authenticated;
revoke execute on function public.platform_setting(text) from public, anon;
grant execute on function public.execute_trade(uuid, text, numeric) to authenticated;
grant execute on function public.request_withdrawal(bigint, text, text, text) to authenticated;
grant execute on function public.platform_setting(text) to authenticated;
grant execute on function public.complete_deposit(text, text, bigint) to service_role;
grant execute on function public.refund_withdrawal(uuid) to service_role, authenticated;
