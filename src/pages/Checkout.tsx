import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Lock, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useDeal } from "@/hooks/useDeals";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("deal");
  const subId = searchParams.get("sub");
  const status = searchParams.get("status");
  const { data: deal, isLoading } = useDeal(dealId || undefined);
  const { user } = useAuth();
  const { clearCart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);

  // Handle callback from Paystack
  const isSuccess = status === "success";

  useEffect(() => {
    if (isSuccess) {
      clearCart();
    }
  }, [isSuccess, clearCart]);

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 max-w-lg mx-auto text-center">
          {/* Animated success icon */}
          <div className="relative mx-auto mb-8 w-28 h-28 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ backgroundColor: "hsl(120 60% 41%)" }}
            />
            <div
              className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: "hsl(120 60% 41% / 0.12)" }}
            >
              <svg
                viewBox="0 0 52 52"
                className="w-14 h-14"
                style={{ color: "hsl(120 60% 41%)" }}
              >
                <circle
                  cx="26"
                  cy="26"
                  r="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 26l9 9 16-16"
                />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-display font-bold text-foreground mb-3">
            Deal Purchased Successfully!
          </h1>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            🎉 Your deal has been purchased. A confirmation has been sent to your email.
          </p>
          <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
            Your coupon is now available in <strong>My Stuff</strong>. Present it to the merchant to redeem your discount.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/my-stuff"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "hsl(120 60% 41%)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              View My Coupons
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold border border-border text-foreground rounded-lg hover:bg-secondary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Continue Shopping
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const handlePaystackPayment = async () => {
    if (!user) {
      toast({ title: "Please sign in to continue", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (!deal) return;

    setPaying(true);
    try {
      const activeSub = subId ? deal.subDeals.find((s) => s.id === subId) : null;
      const amount = activeSub ? activeSub.discounted_price : deal.currentPrice;

      // Get the Firebase ID token for the currently signed-in user
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("No authenticated Firebase user found. Please sign in again.");
      }
      const idToken = await firebaseUser.getIdToken();

      const res = await fetch(
        `https://us-central1-vecsale-6ff3a.cloudfunctions.net/initializePayment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            deal_id: deal.id,
            option_id: activeSub?.id || null,
            amount,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.authorization_url) {
        throw new Error(data.error || "Payment initialization failed");
      }

      // Redirect to Paystack's hosted checkout page
      window.location.href = data.authorization_url;
    } catch (err: any) {
      console.error("Payment error:", err);
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
      setPaying(false);
    }
  };

  const activeSub = deal && subId ? deal.subDeals.find((s) => s.id === subId) : null;
  const displayPrice = activeSub ? activeSub.discounted_price : deal?.currentPrice ?? 0;
  const displayOriginal = activeSub ? activeSub.original_price : deal?.originalPrice ?? 0;
  const displayDiscount = activeSub
    ? Math.round(((activeSub.original_price - activeSub.discounted_price) / activeSub.original_price) * 100)
    : deal?.discount ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 max-w-3xl">
        <Link to={deal ? `/deal/${deal.id}` : "/"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl font-display font-bold text-foreground mb-6">Checkout</h1>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-3 space-y-6">
              <div className="bg-card rounded-xl p-6" style={{ boxShadow: "var(--shadow-card)" }}>
                <h2 className="font-display font-bold text-foreground mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-accent" /> Payment
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  You'll be redirected to Paystack's secure payment page to complete your purchase.
                </p>
                <div className="bg-secondary rounded-lg p-4 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Secure Payment</p>
                    <p className="text-xs text-muted-foreground">Your payment is processed securely by Paystack. We never store your card details.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="bg-card rounded-xl p-6 sticky top-24" style={{ boxShadow: "var(--shadow-card)" }}>
                <h2 className="font-display font-bold text-foreground mb-4">Order Summary</h2>
                {deal ? (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <img src={deal.image} alt={deal.title} className="w-16 h-16 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground line-clamp-2">
                          {activeSub ? activeSub.title : deal.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{deal.merchant}</p>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3 space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span><span className="font-bold text-primary">GH₵{displayOriginal}</span>
                      </div>
                      <div className="flex justify-between text-accent font-semibold">
                        <span>Discount (-{displayDiscount}%)</span><span className="text-[#E65100] font-bold">-GH₵{displayOriginal - displayPrice}</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground text-base pt-2 border-t border-border">
                        <span>Total</span><span className="text-primary">GH₵{displayPrice}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No items in checkout.</p>
                )}

                <button
                  onClick={handlePaystackPayment}
                  disabled={paying || !deal}
                  className="w-full mt-5 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {paying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : (
                    <><Lock className="w-4 h-4" /> Pay with Paystack</>
                  )}
                </button>
                <p className="text-xs text-center text-muted-foreground mt-3 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> Secure checkout powered by Paystack
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Checkout;
