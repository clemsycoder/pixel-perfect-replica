import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIN_DEPOSIT_KOBO, MAX_DEPOSIT_KOBO, MIN_WITHDRAWAL_KOBO, computeWithdrawalFee, DEFAULT_WITHDRAWAL_FEE_BPS, DEFAULT_WITHDRAWAL_FEE_MIN_KOBO } from "./fees";
import type { LedgerEntryDTO } from "./trading.functions";

export interface WalletDTO {
  balanceKobo: number;
  currency: string;
  ledger: LedgerEntryDTO[];
  deposits: { id: string; txRef: string; amountKobo: number; status: string; createdAt: string }[];
  withdrawals: {
    id: string;
    amountKobo: number;
    feeKobo: number;
    destinationBank: string;
    destinationAccount: string;
    status: string;
    createdAt: string;
  }[];
}

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletDTO> => {
    const { supabase, userId } = context;
    const [walletRes, ledgerRes, depositsRes, withdrawalsRes] = await Promise.all([
      supabase.from("wallets").select("balance_kobo, currency").eq("user_id", userId).single(),
      supabase
        .from("wallet_ledger")
        .select("id, entry_type, direction, amount_kobo, balance_after_kobo, reference, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("deposits")
        .select("id, tx_ref, amount_kobo, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("withdrawals")
        .select("id, amount_kobo, fee_kobo, destination_bank, destination_account, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    if (walletRes.error) throw new Error("Failed to load your wallet");

    return {
      balanceKobo: walletRes.data.balance_kobo,
      currency: walletRes.data.currency,
      ledger: (ledgerRes.data ?? []).map((l) => ({
        id: l.id,
        entryType: l.entry_type,
        direction: l.direction as "credit" | "debit",
        amountKobo: l.amount_kobo,
        balanceAfterKobo: l.balance_after_kobo,
        reference: l.reference,
        description: l.description,
        createdAt: l.created_at,
      })),
      deposits: (depositsRes.data ?? []).map((d) => ({
        id: d.id,
        txRef: d.tx_ref,
        amountKobo: d.amount_kobo,
        status: d.status,
        createdAt: d.created_at,
      })),
      withdrawals: (withdrawalsRes.data ?? []).map((w) => ({
        id: w.id,
        amountKobo: w.amount_kobo,
        feeKobo: w.fee_kobo,
        destinationBank: w.destination_bank,
        destinationAccount: w.destination_account,
        status: w.status,
        createdAt: w.created_at,
      })),
    };
  });

export const withdrawalFeePreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amountKobo: number }) => input)
  .handler(async ({ data }) => {
    const fee = computeWithdrawalFee(
      data.amountKobo,
      DEFAULT_WITHDRAWAL_FEE_BPS,
      DEFAULT_WITHDRAWAL_FEE_MIN_KOBO,
    );
    return { feeKobo: fee, netKobo: Math.max(0, data.amountKobo - fee) };
  });

// ---------- Deposits (Flutterwave) ----------

const FLW_API = "https://api.flutterwave.com/v3";

function flwConfig() {
  const secretKey = process.env["FLUTTERWAVE_SECRET_KEY"];
  const secretHash = process.env["FLUTTERWAVE_SECRET_HASH"];
  if (!secretKey) return null;
  return { secretKey, secretHash: secretHash ?? null };
}

interface FlwVerifyResponse {
  status?: string;
  message?: string;
  data?: {
    id?: number;
    status?: string;
    tx_ref?: string;
    amount?: number;
    currency?: string;
    flw_ref?: string;
  };
}

async function verifyWithFlutterwave(secretKey: string, txRef: string): Promise<FlwVerifyResponse["data"]> {
  const res = await fetch(`${FLW_API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secretKey}`, accept: "application/json" },
  });
  const body = (await res.json().catch(() => null)) as FlwVerifyResponse | null;
  if (!res.ok || body?.status !== "success" || !body.data) {
    throw new Error(body?.message || "Payment verification failed");
  }
  return body.data;
}

async function creditDeposit(txRef: string, providerRef: string, amountKobo: bigint) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("complete_deposit", {
    p_tx_ref: txRef,
    p_provider_ref: providerRef,
    p_amount_kobo: Number(amountKobo),
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Start a wallet funding flow: record the pending deposit and return the hosted payment link. */
export const initDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amountKobo: number }) => {
    const amount = Math.round(Number(input?.amountKobo));
    if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_KOBO) {
      throw new Error(`Minimum funding amount is ${MIN_DEPOSIT_KOBO / 100} naira`);
    }
    if (amount > MAX_DEPOSIT_KOBO) throw new Error("Amount is too large");
    return { amountKobo: amount };
  })
  .handler(async ({ data, context }) => {
    const flw = flwConfig();
    if (!flw) {
      throw new Error("Wallet funding is not configured yet — a Flutterwave key is needed.");
    }
    const { supabase, userId, claims } = context;

    const txRef = `lumora-${userId.slice(0, 8)}-${Date.now().toString(36)}`;
    const { data: deposit, error } = await supabase
      .from("deposits")
      .insert({ user_id: userId, tx_ref: txRef, amount_kobo: data.amountKobo })
      .select("id")
      .single();
    if (error) throw new Error("Could not start this payment");

    const origin = getRequestHeader("origin") || "https://lumora.app";
    const redirectUrl = `${origin}/wallet?flw_return=${encodeURIComponent(txRef)}`;

    const res = await fetch(`${FLW_API}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${flw.secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: data.amountKobo / 100,
        currency: "NGN",
        redirect_url: redirectUrl,
        customer: { email: claims["email"] ?? undefined },
        meta: { deposit_id: deposit.id },
      }),
    });
    const body = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: { link?: string } } | null;
    if (!res.ok || body?.status !== "success" || !body?.data?.link) {
      throw new Error(body?.message || "Could not start the payment — try again.");
    }
    return { paymentLink: body.data.link, txRef };
  });

/** Verify a Flutterwave payment on return and credit the wallet. */
export const verifyDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { txRef: string }) => {
    if (!input?.txRef) throw new Error("Missing payment reference");
    return input;
  })
  .handler(async ({ data, context }) => {
    const flw = flwConfig();
    if (!flw) throw new Error("Payment verification is not configured yet");
    const { supabase, userId } = context;

    const { data: deposit } = await supabase
      .from("deposits")
      .select("id, amount_kobo, status, user_id")
      .eq("tx_ref", data.txRef)
      .single();
    if (!deposit || deposit.user_id !== userId) {
      throw new Error("Unknown payment reference");
    }
    if (deposit.status === "successful") {
      return { alreadyProcessed: true as const, creditedKobo: deposit.amount_kobo };
    }

    const tx = await verifyWithFlutterwave(flw.secretKey, data.txRef);
    if (tx.status !== "successful" || tx.currency !== "NGN" || !tx.tx_ref) {
      return { failed: true as const, status: tx.status ?? "unknown" };
    }
    const expectedKobo = BigInt(deposit.amount_kobo);
    const paidKobo = BigInt(Math.round((tx.amount ?? 0) * 100));
    if (paidKobo !== expectedKobo) {
      throw new Error("Paid amount does not match the requested funding amount");
    }
    await creditDeposit(tx.tx_ref, String(tx.id ?? tx.flw_ref ?? ""), paidKobo);
    return { creditedKobo: Number(paidKobo) };
  });

// ---------- Withdrawals ----------

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { amountKobo: number; destinationName: string; destinationBank: string; destinationAccount: string }) => {
      const amount = Math.round(Number(input?.amountKobo));
      if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_KOBO) {
        throw new Error("Minimum withdrawal is ₦100");
      }
      const name = (input.destinationName ?? "").trim();
      const bank = (input.destinationBank ?? "").trim();
      const account = (input.destinationAccount ?? "").trim();
      if (name.length < 3) throw new Error("Enter the account holder name");
      if (bank.length < 2) throw new Error("Enter the bank name");
      if (!/^\d{10}$/.test(account)) throw new Error("Enter a valid 10-digit account number");
      return { amountKobo: amount, destinationName: name, destinationBank: bank, destinationAccount: account };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("request_withdrawal", {
      p_amount_kobo: data.amountKobo,
      p_destination_name: data.destinationName,
      p_destination_bank: data.destinationBank,
      p_destination_account: data.destinationAccount,
    });
    if (error) throw new Error(error.message);
    return result as { withdrawal_id: string; fee_kobo: number; amount_kobo: number; balance_after_kobo: number };
  });
