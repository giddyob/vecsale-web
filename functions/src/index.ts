import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// Define secret parameters for v2
const paystackSecretKey = defineString("PAYSTACK_SECRET_KEY");

// ─── Helper: Verify Paystack HMAC-SHA512 Signature ──────────────────────────
function verifyPaystackSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

// ─── Paystack Webhook Cloud Function ─────────────────────────────────────────
export const paystackWebhook = onRequest({
  // Ensure we can access the raw body if needed, although v2 handles it well.
}, async (req, res) => {
  // Only accept POST
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const paystackSecret = paystackSecretKey.value();

    if (!paystackSecret) {
      logger.error("Paystack secret key not configured");
      res.status(500).send("Payment not configured");
      return;
    }

    // ── 2. Verify Paystack HMAC-SHA512 signature ───────────────────────────
    const signature = req.headers["x-paystack-signature"] as string;
    if (!signature) {
      logger.warn("Missing x-paystack-signature header");
      res.status(400).send("No signature");
      return;
    }

    // In v2, req.rawBody is often available or req.body is already parsed.
    // For signature verification, we need the raw body.
    const rawBody = (req as any).rawBody?.toString("utf8") ?? JSON.stringify(req.body);

    const isValid = verifyPaystackSignature(rawBody, signature, paystackSecret);
    if (!isValid) {
      logger.error("Invalid Paystack signature — possible spoofed request");
      res.status(400).send("Invalid signature");
      return;
    }

    // ── 3. Parse event ─────────────────────────────────────────────────────
    const event = req.body;
    logger.info("Paystack webhook event received:", event.event);

    // Only process successful charges
    if (event.event !== "charge.success") {
      res.status(200).send("OK");
      return;
    }

    const { metadata, reference, amount } = event.data as {
      metadata: Record<string, any>;
      reference: string;
      amount: number;
    };

    logger.info("Metadata:", JSON.stringify(metadata));

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
      logger.error(
        "Missing deal_id or user_id in metadata:",
        JSON.stringify(metadata)
      );
      res.status(400).send("Missing metadata");
      return;
    }

    // ── 4. Generate coupon code from Paystack reference ────────────────────
    const code = `VS-${reference.slice(-8).toUpperCase()}`;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const amountGHS = amount / 100; // Convert pesewas → GHS

    // ── 5. Look up deal + merchant details for the coupon snapshot ─────────
    let business_id: string | null = null;
    let business_name: string | null = null;
    let dealSnapshot: Record<string, any> = {};
    try {
      const dealSnap = await db.collection("deals").doc(deal_id).get();
      if (dealSnap.exists) {
        const dealData = dealSnap.data()!;

        // Build a snapshot of the deal at purchase time
        dealSnapshot = {
          title: dealData.title || null,
          image_url: dealData.image_url || null,
          discounted_price: dealData.discounted_price ?? null,
          original_price: dealData.original_price ?? null,
          location: dealData.location || null,
          description: dealData.description || null,
          expiry_date: dealData.expiry_date || null,
          category: dealData.category || null,
        };

        // Robust merchant ID resolution — check all possible fields
        const getStrId = (val: any) => typeof val === "string" ? val : val?.id || null;
        let refId = getStrId(dealData.merchantId) ||
                    getStrId(dealData.merchants) ||
                    getStrId(dealData.merchant_id) ||
                    getStrId(dealData.merchants_id) ||
                    getStrId(dealData.business_id) ||
                    getStrId(dealData.businesses);

        // merchant field might hold an ID instead of a name
        if (!refId && typeof dealData.merchant === "string" &&
            !dealData.merchant.includes(" ") && dealData.merchant.length >= 8) {
          refId = dealData.merchant;
        }

        business_id = refId || null;

        // Resolve business/merchant details from merchants collection
        if (business_id) {
          try {
            const merchantSnap = await db.collection("merchants").doc(business_id).get();
            if (merchantSnap.exists) {
              const merchantData = merchantSnap.data()!;
              business_name = merchantData.name || null;
              dealSnapshot.business_name = business_name;
              dealSnapshot.business_logo = merchantData.logo || merchantData.avatarUrl || null;
              dealSnapshot.business_location = merchantData.location || null;
              dealSnapshot.business_phone = merchantData.phone || null;
            }
          } catch (merchantErr) {
            logger.warn("Could not fetch merchant for business_name:", merchantErr);
          }
        }

        // If no merchant found by ID, try name-based lookup
        if (!business_name) {
          const nameStr = dealData.merchant || dealData.merchants?.name || dealData.businesses?.name;
          if (nameStr && typeof nameStr === "string") {
            try {
              const allMerchants = await db.collection("merchants").get();
              for (const mDoc of allMerchants.docs) {
                const mData = mDoc.data();
                if (mData.name && mData.name.toLowerCase().trim() === nameStr.toLowerCase().trim()) {
                  business_id = mDoc.id;
                  business_name = mData.name;
                  dealSnapshot.business_name = business_name;
                  dealSnapshot.business_logo = mData.logo || mData.avatarUrl || null;
                  dealSnapshot.business_location = mData.location || null;
                  dealSnapshot.business_phone = mData.phone || null;
                  break;
                }
              }
            } catch (nameErr) {
              logger.warn("Could not do name-based merchant lookup:", nameErr);
            }
          }
        }

        // Last resort: use the merchant string from the deal as the name
        if (!business_name) {
          business_name = dealData.merchant || null;
          dealSnapshot.business_name = business_name;
        }
      }
    } catch (dealErr) {
      logger.warn("Could not fetch deal for business_id:", dealErr);
    }

    // ── 6. Save coupon to Firestore ────────────────────────────────────────
    const couponData: Record<string, any> = {
      user_id,
      deal_id,
      code,
      status: "unused",
      paystackRef: reference,
      purchase_date: now,
      deal_snapshot: dealSnapshot,
    };
    if (option_id) couponData.option_id = option_id;
    if (business_id) couponData.business_id = business_id;
    if (business_name) couponData.business_name = business_name;

    const couponRef = await db.collection("coupons").add(couponData);
    logger.info("Coupon created:", couponRef.id, code);

    // ── 7. Save transaction to Firestore ───────────────────────────────────
    const txData: Record<string, any> = {
      user_id,
      deal_id,
      type: "purchase",
      amount: amountGHS,
      currency: "GHS",
      status: "completed",
      description: `Deal purchase — ${code}`,
      paystackRef: reference,
      purchase_date: now,
    };
    if (option_id) txData.option_id = option_id;
    if (business_id) txData.business_id = business_id;

    const txRef = await db.collection("transactions").add(txData);
    logger.info("Transaction created:", txRef.id);

    // ── 8. Increment deal salesCount (atomic) ──────────────────────────────
    try {
      const dealRef = db.collection("deals").doc(deal_id);
      await dealRef.update({
        salesCount: admin.firestore.FieldValue.increment(1),
      });
    } catch (salesErr) {
      logger.warn("Could not increment deal salesCount:", salesErr);
    }

    logger.info("Webhook processed successfully:", {
      reference,
      code,
      deal_id,
      user_id,
      business_id,
    });

    res.status(200).send("OK");
  } catch (err: any) {
    logger.error("Webhook error:", err);
    res.status(500).send("Server error");
  }
});

// ─── Initialize Payment Cloud Function ───────────────────────────────────────
export const initializePayment = onRequest({
  cors: true, // v2 makes CORS easy
}, async (req, res) => {
  logger.info("initializePayment hit", { method: req.method, headers: req.headers });

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // ── 1. Verify Firebase ID token ────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      logger.warn("Missing or malformed Authorization header");
      res.status(401).json({ error: "Unauthorized — missing Firebase ID token" });
      return;
    }

    const idToken = authHeader.replace("Bearer ", "").trim();
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (authErr: any) {
      logger.error("Token verification failed:", authErr.message);
      res.status(401).json({ error: `Unauthorized — invalid Firebase token: ${authErr.message}` });
      return;
    }

    const uid = decodedToken.uid;
    const email = decodedToken.email || "";

    // ── 2. Parse request body ──────────────────────────────────────────────
    const { deal_id, option_id, amount } = req.body as {
      deal_id: string;
      option_id?: string | null;
      amount: number;
    };

    if (!deal_id || !amount) {
      res.status(400).json({ error: "deal_id and amount are required" });
      return;
    }

    // ── 3. Get Paystack secret ─────────────────────────────────────────────
    const paystackSecret = paystackSecretKey.value();

    if (!paystackSecret) {
      res.status(500).json({ error: "Payment not configured" });
      return;
    }

    // ── 4. Determine callback URL ──────────────────────────────────────────
    const origin =
      req.headers.origin ||
      req.headers.referer?.split("/").slice(0, 3).join("/") ||
      "https://vecsale.lovable.app";

    const callbackUrl = `${origin}/checkout?status=success`;

    // ── 5. Initialize Paystack transaction ─────────────────────────────────
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
          amount: Math.round(amount * 100), // pesewas
          currency: "GHS",
          metadata: {
            deal_id,
            option_id: option_id || null,
            user_id: uid,
            custom_fields: [
              {
                display_name: "Deal ID",
                variable_name: "deal_id",
                value: deal_id,
              },
              {
                display_name: "User ID",
                variable_name: "user_id",
                value: uid,
              },
              ...(option_id
                ? [
                    {
                      display_name: "Option ID",
                      variable_name: "option_id",
                      value: option_id,
                    },
                  ]
                : []),
            ],
          },
          callback_url: callbackUrl,
        }),
      }
    );

    const paystackData = await paystackRes.json() as any;

    if (!paystackData.status) {
      logger.error("Paystack init error:", paystackData);
      res
        .status(400)
        .json({ error: paystackData.message || "Payment initialization failed" });
      return;
    }

    logger.info("Payment initialized:", {
      reference: paystackData.data.reference,
      deal_id,
      uid,
    });

    res.status(200).json({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
    });
  } catch (err: any) {
    logger.error("initializePayment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Verify Payment & Create Coupon (frontend-triggered, no webhook needed) ───
export const verifyPayment = onRequest({
  cors: true,
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // ── 1. Verify Firebase ID token ────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const idToken = authHeader.replace("Bearer ", "").trim();
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const uid = decodedToken.uid;

    // ── 2. Get reference ───────────────────────────────────────────────────
    const { reference } = req.body as { reference: string };
    if (!reference) {
      res.status(400).json({ error: "reference is required" });
      return;
    }

    // ── 3. Idempotency: return existing coupon if already created ──────────
    const existing = await db
      .collection("coupons")
      .where("paystackRef", "==", reference)
      .limit(1)
      .get();
    if (!existing.empty) {
      const doc = existing.docs[0];
      logger.info("Returning existing coupon for reference:", reference);
      res.status(200).json({ success: true, coupon: { id: doc.id, code: doc.data().code } });
      return;
    }

    // ── 4. Verify transaction with Paystack ────────────────────────────────
    const paystackSecret = paystackSecretKey.value();
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } }
    );
    const verifyData = await verifyRes.json() as any;

    if (!verifyData.status || verifyData.data?.status !== "success") {
      logger.warn("Payment not successful:", verifyData.data?.status);
      res.status(400).json({ error: "Payment not successful", status: verifyData.data?.status });
      return;
    }

    const { metadata, amount } = verifyData.data as {
      metadata: Record<string, any>;
      amount: number;
    };

    // ── 5. Extract metadata ────────────────────────────────────────────────
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
      res.status(400).json({ error: "Missing deal_id or user_id in metadata" });
      return;
    }

    // ── Security: requesting user must match the paying user ───────────────
    if (user_id !== uid) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // ── 6. Look up deal + merchant details for the coupon snapshot ─────────
    let business_id: string | null = null;
    let business_name: string | null = null;
    let dealSnapshot: Record<string, any> = {};
    try {
      const dealSnap = await db.collection("deals").doc(deal_id).get();
      if (dealSnap.exists) {
        const dealData = dealSnap.data()!;

        // Build a snapshot of the deal at purchase time
        dealSnapshot = {
          title: dealData.title || null,
          image_url: dealData.image_url || null,
          discounted_price: dealData.discounted_price ?? null,
          original_price: dealData.original_price ?? null,
          location: dealData.location || null,
          description: dealData.description || null,
          expiry_date: dealData.expiry_date || null,
          category: dealData.category || null,
        };

        // Robust merchant ID resolution — check all possible fields
        const getStrId = (val: any) => typeof val === "string" ? val : val?.id || null;
        let refId = getStrId(dealData.merchantId) ||
                    getStrId(dealData.merchants) ||
                    getStrId(dealData.merchant_id) ||
                    getStrId(dealData.merchants_id) ||
                    getStrId(dealData.business_id) ||
                    getStrId(dealData.businesses);

        // merchant field might hold an ID instead of a name
        if (!refId && typeof dealData.merchant === "string" &&
            !dealData.merchant.includes(" ") && dealData.merchant.length >= 8) {
          refId = dealData.merchant;
        }

        business_id = refId || null;

        // Resolve business/merchant details from merchants collection
        if (business_id) {
          try {
            const merchantSnap = await db.collection("merchants").doc(business_id).get();
            if (merchantSnap.exists) {
              const merchantData = merchantSnap.data()!;
              business_name = merchantData.name || null;
              dealSnapshot.business_name = business_name;
              dealSnapshot.business_logo = merchantData.logo || merchantData.avatarUrl || null;
              dealSnapshot.business_location = merchantData.location || null;
              dealSnapshot.business_phone = merchantData.phone || null;
            }
          } catch (merchantErr) {
            logger.warn("Could not fetch merchant for business_name:", merchantErr);
          }
        }

        // If no merchant found by ID, try name-based lookup
        if (!business_name) {
          const nameStr = dealData.merchant || dealData.merchants?.name || dealData.businesses?.name;
          if (nameStr && typeof nameStr === "string") {
            try {
              const allMerchants = await db.collection("merchants").get();
              for (const mDoc of allMerchants.docs) {
                const mData = mDoc.data();
                if (mData.name && mData.name.toLowerCase().trim() === nameStr.toLowerCase().trim()) {
                  business_id = mDoc.id;
                  business_name = mData.name;
                  dealSnapshot.business_name = business_name;
                  dealSnapshot.business_logo = mData.logo || mData.avatarUrl || null;
                  dealSnapshot.business_location = mData.location || null;
                  dealSnapshot.business_phone = mData.phone || null;
                  break;
                }
              }
            } catch (nameErr) {
              logger.warn("Could not do name-based merchant lookup:", nameErr);
            }
          }
        }

        // Last resort: use the merchant string from the deal as the name
        if (!business_name) {
          business_name = dealData.merchant || null;
          dealSnapshot.business_name = business_name;
        }
      }
    } catch (e) {
      logger.warn("Could not fetch deal for business_id:", e);
    }

    const code = `VS-${reference.slice(-8).toUpperCase()}`;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const amountGHS = amount / 100;

    // ── 7. Save coupon ─────────────────────────────────────────────────────
    const couponData: Record<string, any> = {
      user_id,
      deal_id,
      code,
      status: "unused",
      paystackRef: reference,
      purchase_date: now,
      deal_snapshot: dealSnapshot,
    };
    if (option_id) couponData.option_id = option_id;
    if (business_id) couponData.business_id = business_id;
    if (business_name) couponData.business_name = business_name;

    const couponRef = await db.collection("coupons").add(couponData);
    logger.info("Coupon created via verifyPayment:", couponRef.id, code);

    // ── 8. Save transaction ────────────────────────────────────────────────
    const txData: Record<string, any> = {
      user_id,
      deal_id,
      type: "purchase",
      amount: amountGHS,
      currency: "GHS",
      status: "completed",
      description: `Deal purchase — ${code}`,
      paystackRef: reference,
      purchase_date: now,
    };
    if (option_id) txData.option_id = option_id;
    if (business_id) txData.business_id = business_id;

    await db.collection("transactions").add(txData);

    // ── 9. Increment salesCount ────────────────────────────────────────────
    try {
      await db.collection("deals").doc(deal_id).update({
        salesCount: admin.firestore.FieldValue.increment(1),
      });
    } catch (e) {
      logger.warn("Could not increment salesCount:", e);
    }

    res.status(200).json({ success: true, coupon: { id: couponRef.id, code } });
  } catch (err: any) {
    logger.error("verifyPayment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
