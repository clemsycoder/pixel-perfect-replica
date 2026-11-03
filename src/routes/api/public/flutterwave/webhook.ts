// Flutterwave webhook: the only fully unauthenticated entry point into wallet
// credits. The handler verifies the Flutterwave signature header, re-verifies
// the transaction against Flutterwave's API, and only then credits the deposit
// through the idempotent complete_deposit SQL function.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/flutterwave/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretHash = process.env["FLUTTERWAVE_SECRET_HASH"];
        const secretKey = process.env["FLUTTERWAVE_SECRET_KEY"];
        if (!secretHash || !secretKey) {
          return Response.json({ error: "Webhook not configured" }, { status: 503 });
        }

        if (request.headers.get("verif-hash") !== secretHash) {
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        let body: {
          event?: string;
          data?: { id?: number; tx_ref?: string; status?: string; amount?: number; currency?: string; flw_ref?: string };
        } | null = null;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        const tx = body?.data;
        if (body?.event !== "charge.completed" || !tx?.tx_ref) {
          return Response.json({ received: true });
        }
        if (tx.status !== "successful" || tx.currency !== "NGN") {
          return Response.json({ received: true, ignored: true });
        }

        try {
          // Never trust the webhook payload: re-verify with Flutterwave.
          const res = await fetch(
            `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx.tx_ref)}`,
            { headers: { Authorization: `Bearer ${secretKey}`, accept: "application/json" } },
          );
          const verified = (await res.json().catch(() => null)) as {
            status?: string;
            data?: { status?: string; currency?: string; amount?: number; id?: number; flw_ref?: string };
          } | null;
          if (
            !res.ok ||
            verified?.status !== "success" ||
            verified.data?.status !== "successful" ||
            verified.data.currency !== "NGN" ||
            verified.data.amount == null
          ) {
            return Response.json({ error: "Verification failed" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.rpc("complete_deposit", {
            p_tx_ref: tx.tx_ref,
            p_provider_ref: String(verified.data.id ?? verified.data.flw_ref ?? ""),
            p_amount_kobo: Math.round(verified.data.amount * 100),
          });
          return Response.json({ received: true });
        } catch (err) {
          console.error("[flutterwave webhook]", err instanceof Error ? err.message : err);
          return Response.json({ error: "Could not process payment" }, { status: 500 });
        }
      },
    },
  },
});
