import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Verify a Firebase ID token using the Firebase Auth REST API.
 * Returns { uid, email } on success, throws on failure.
 */
async function verifyFirebaseToken(
  idToken: string
): Promise<{ uid: string; email: string }> {
  const apiKey = Deno.env.get("FIREBASE_API_KEY");
  if (!apiKey) throw new Error("FIREBASE_API_KEY secret not set");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Firebase token verification failed");
  }

  const data = await res.json();
  const userInfo = data?.users?.[0];
  if (!userInfo) throw new Error("No user found for token");

  return { uid: userInfo.localId, email: userInfo.email || "" };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── 1. Extract and verify Firebase ID token ─────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — missing Firebase ID token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const idToken = authHeader.replace("Bearer ", "").trim();
    let uid: string;
    let email: string;

    try {
      ({ uid, email } = await verifyFirebaseToken(idToken));
    } catch (verifyErr: any) {
      console.error("Token verification failed:", verifyErr.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid Firebase token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 2. Parse request body ────────────────────────────────────────────────
    const { deal_id, option_id, amount } = await req.json();

    if (!deal_id || !amount) {
      return new Response(
        JSON.stringify({ error: "deal_id and amount are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 3. Check Paystack secret ─────────────────────────────────────────────
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(
        JSON.stringify({ error: "Payment not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 4. Initialize Paystack transaction ───────────────────────────────────
    // Determine callback URL (support local dev + production)
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
      "https://vecsale.lovable.app";

    const callbackUrl = `${origin}/checkout?status=success`;

    const paystackRes = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          // Paystack amounts are in lowest currency unit (pesewas for GHS)
          amount: Math.round(amount * 100),
          currency: "GHS",
          metadata: {
            deal_id,
            option_id: option_id || null,
            user_id: uid,
            // Also set custom_fields for Paystack dashboard readability
            custom_fields: [
              { display_name: "Deal ID", variable_name: "deal_id", value: deal_id },
              { display_name: "User ID", variable_name: "user_id", value: uid },
              ...(option_id
                ? [{ display_name: "Option ID", variable_name: "option_id", value: option_id }]
                : []),
            ],
          },
          callback_url: callbackUrl,
        }),
      }
    );

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error("Paystack initialization error:", paystackData);
      return new Response(
        JSON.stringify({
          error: paystackData.message || "Payment initialization failed",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Payment initialized:", {
      reference: paystackData.data.reference,
      deal_id,
      uid,
    });

    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("initialize-payment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
