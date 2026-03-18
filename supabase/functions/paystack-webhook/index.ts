import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

// ─── Firebase Firestore Helpers (REST API) ──────────────────────────────────
// The Firebase Admin SDK doesn't support Deno natively, so we use the
// Firestore REST API authenticated with a Google Service Account JWT.

/** Build a signed JWT access token from the service account credentials. */
async function getFirebaseAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const rawPrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");
  if (!clientEmail || !rawPrivateKey) {
    throw new Error("FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY secret not set");
  }

  // Fix escaped newlines that can occur when secrets are stored as strings
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the RSA private key
  const pemContents = privateKey
    .replace("-----BEGIN RSA PRIVATE KEY-----", "")
    .replace("-----END RSA PRIVATE KEY-----", "")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signingInput)
  );

  const signatureB64 = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${signatureB64}`;

  // Exchange the signed JWT for an OAuth2 access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to get Firebase access token: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

/** Write a document to Firestore using the REST API. */
async function firestoreSet(
  projectId: string,
  collectionPath: string,
  docId: string,
  fields: Record<string, any>,
  accessToken: string
): Promise<void> {
  // Convert plain JS object to Firestore REST format
  function toFirestoreValue(val: any): any {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === "boolean") return { booleanValue: val };
    if (typeof val === "number" && Number.isInteger(val)) return { integerValue: String(val) };
    if (typeof val === "number") return { doubleValue: val };
    if (typeof val === "string") return { stringValue: val };
    if (val instanceof Date) return { timestampValue: val.toISOString() };
    if (typeof val === "object") {
      return {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(val).map(([k, v]) => [k, toFirestoreValue(v)])
          ),
        },
      };
    }
    return { stringValue: String(val) };
  }

  const firestoreFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    firestoreFields[key] = toFirestoreValue(value);
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}/${docId}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore write failed (${res.status}): ${errText}`);
  }
}

/** Add a document with auto-generated ID to a Firestore collection. */
async function firestoreAdd(
  projectId: string,
  collectionPath: string,
  data: Record<string, any>,
  accessToken: string
): Promise<string> {
  function toFirestoreValue(val: any): any {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === "boolean") return { booleanValue: val };
    if (typeof val === "number" && Number.isInteger(val)) return { integerValue: String(val) };
    if (typeof val === "number") return { doubleValue: val };
    if (typeof val === "string") return { stringValue: val };
    if (val instanceof Date) return { timestampValue: val.toISOString() };
    if (typeof val === "object") {
      return {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(val).map(([k, v]) => [k, toFirestoreValue(v)])
          ),
        },
      };
    }
    return { stringValue: String(val) };
  }

  const firestoreFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    firestoreFields[key] = toFirestoreValue(value);
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore add failed (${res.status}): ${errText}`);
  }

  const created = await res.json();
  // Extract the auto-generated document ID from the resource name
  const docName: string = created.name;
  return docName.split("/").pop() || "";
}

// ─── Main Webhook Handler ───────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response("Payment not configured", { status: 500 });
    }

    const body = await req.text();

    // ── 1. Verify Paystack HMAC-SHA512 signature ──────────────────────────
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      console.error("Missing x-paystack-signature header");
      return new Response("No signature", { status: 400 });
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(paystackSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hash = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (hash !== signature) {
      console.error("Invalid Paystack signature — possible spoofed request");
      return new Response("Invalid signature", { status: 400 });
    }

    // ── 2. Parse event ────────────────────────────────────────────────────
    const event = JSON.parse(body);
    console.info("Paystack webhook event:", event.event);

    // Only process successful charges
    if (event.event !== "charge.success") {
      return new Response("OK", { status: 200 });
    }

    const { metadata, reference, amount } = event.data;
    console.info("Full metadata:", JSON.stringify(metadata));

    // Paystack can nest custom metadata in different ways — handle both
    let deal_id: string | undefined = metadata?.deal_id;
    let option_id: string | undefined = metadata?.option_id;
    let user_id: string | undefined = metadata?.user_id;

    if (!deal_id && metadata?.custom_fields) {
      for (const field of metadata.custom_fields) {
        if (field.variable_name === "deal_id") deal_id = field.value;
        if (field.variable_name === "option_id") option_id = field.value;
        if (field.variable_name === "user_id") user_id = field.value;
      }
    }

    if (!deal_id || !user_id) {
      console.error("Missing deal_id or user_id in metadata:", JSON.stringify(metadata));
      return new Response("Missing metadata", { status: 400 });
    }

    // ── 3. Get Firebase access token ──────────────────────────────────────
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || "vecsale-6ff3a";
    const accessToken = await getFirebaseAccessToken();

    // ── 4. Generate coupon code from Paystack reference ───────────────────
    const code = `VS-${reference.slice(-8).toUpperCase()}`;
    const now = new Date();

    // ── 5. Save coupon to Firebase Firestore ─────────────────────────────
    const couponData: Record<string, any> = {
      userId: user_id,
      dealId: deal_id,
      code,
      status: "UNUSED",
      createdAt: now,
      paystackRef: reference,
    };
    if (option_id) {
      couponData.optionId = option_id;
    }

    const couponDocId = await firestoreAdd(
      projectId,
      "coupons",
      couponData,
      accessToken
    );
    console.log("Coupon created in Firestore:", couponDocId, code);

    // ── 6. Save transaction record to Firebase Firestore ──────────────────
    const transactionData: Record<string, any> = {
      userId: user_id,
      dealId: deal_id,
      type: "purchase",
      amount: amount / 100, // Convert pesewas → GHS
      currency: "GHS",
      status: "completed",
      description: `Deal purchase — ${code}`,
      paystackRef: reference,
      createdAt: now,
    };
    if (option_id) {
      transactionData.optionId = option_id;
    }

    const txDocId = await firestoreAdd(
      projectId,
      "transactions",
      transactionData,
      accessToken
    );
    console.log("Transaction created in Firestore:", txDocId);

    // ── 7. Increment deal sales count in Firestore ────────────────────────
    // We do a read-then-write since the Firestore REST API doesn't support
    // atomic field increments without using the runQuery / commit batch API.
    // For low-volume apps this is acceptable; upgrade to Firestore batch
    // transactions if concurrency becomes a concern.
    try {
      const dealUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/deals/${deal_id}`;
      const dealRes = await fetch(dealUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (dealRes.ok) {
        const dealDoc = await dealRes.json();
        const currentSales =
          parseInt(
            dealDoc?.fields?.salesCount?.integerValue ||
              dealDoc?.fields?.sales_count?.integerValue ||
              "0"
          ) || 0;

        await fetch(
          `${dealUrl}?updateMask.fieldPaths=salesCount`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fields: {
                salesCount: { integerValue: String(currentSales + 1) },
              },
            }),
          }
        );
      }
    } catch (salesErr) {
      // Non-critical — log but don't fail the webhook
      console.warn("Could not increment deal salesCount:", salesErr);
    }

    console.log("Webhook processed successfully:", { reference, code, deal_id, user_id });
    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response("Server error", { status: 500 });
  }
});
