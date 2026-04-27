import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Clock, CheckCircle, Eye, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const MyStuff = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["my-coupons", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      // NOTE: combining where() + orderBy() on different fields requires a
      // Firestore composite index. Sort client-side to avoid that requirement.
      const q = query(
        collection(db, "coupons"),
        where("user_id", "==", user!.uid)
      );
      const snapshot = await getDocs(q);
      
      // Pre-fetch all merchants for name-based fallback (same as useDeals.ts)
      const merchantsSnap = await getDocs(collection(db, "merchants"));
      const merchantNameMap: Record<string, { id: string; data: any }> = {};
      const merchantIdMap: Record<string, any> = {};
      merchantsSnap.forEach((mDoc) => {
        const mData = mDoc.data();
        merchantIdMap[mDoc.id] = mData;
        if (mData.name) merchantNameMap[mData.name.toLowerCase().trim()] = { id: mDoc.id, data: mData };
      });

      const couponsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const coupon = { id: docSnap.id, ...docSnap.data() } as any;

          // Prefer the deal_snapshot stored directly on the coupon (new flow)
          if (coupon.deal_snapshot && coupon.deal_snapshot.title) {
            coupon.deals = {
              title: coupon.deal_snapshot.title,
              image_url: coupon.deal_snapshot.image_url,
              discounted_price: coupon.deal_snapshot.discounted_price,
              location: coupon.deal_snapshot.location,
              businesses: {
                name: coupon.deal_snapshot.business_name || coupon.business_name || "Local Merchant",
              },
            };
          } else if (coupon.deal_id) {
            // Fallback for older coupons without a snapshot
            const dealRef = doc(db, "deals", coupon.deal_id);
            const dealSnap = await getDoc(dealRef);
            if (dealSnap.exists()) {
              const dealData = dealSnap.data();

              // Robust merchant resolution (mirrors useDeals.ts logic)
              let merchantName = "Local Merchant";
              const getStrId = (val: any) => typeof val === "string" ? val : val?.id || val?.path?.split("/")?.pop();
              let refId = getStrId(dealData.merchantId) ||
                          getStrId(dealData.merchants) ||
                          getStrId(dealData.merchant_id) ||
                          getStrId(dealData.merchants_id) ||
                          getStrId(dealData.business_id) ||
                          getStrId(dealData.businesses);

              // merchant field might hold an ID instead of a name
              if (!refId && typeof dealData.merchant === "string" && !dealData.merchant.includes(" ") && dealData.merchant.length >= 8) {
                refId = dealData.merchant;
              }

              if (refId && merchantIdMap[refId]) {
                merchantName = merchantIdMap[refId].name || merchantName;
              } else {
                // Name-based fallback
                const nameKey = (dealData.merchant || dealData.merchants?.name || dealData.businesses?.name || "").toLowerCase().trim();
                if (nameKey && merchantNameMap[nameKey]) {
                  merchantName = merchantNameMap[nameKey].data.name;
                } else if (dealData.merchant) {
                  merchantName = dealData.merchant;
                }
              }

              coupon.deals = {
                title: dealData.title,
                image_url: dealData.image_url,
                discounted_price: dealData.discounted_price,
                location: dealData.location,
                businesses: { name: merchantName }
              };
            }
          }
          return coupon;
        })
      );

      // Sort descending by purchase_date client-side
      couponsData.sort((a: any, b: any) => {
        const aDate = a.purchase_date?.toMillis?.() ?? 0;
        const bDate = b.purchase_date?.toMillis?.() ?? 0;
        return bDate - aDate;
      });

      return couponsData;
    },
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "coupons", id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-coupons"] });
      toast.success("Coupon deleted");
    },
    onError: () => toast.error("Failed to delete coupon"),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <h1 className="text-2xl font-display font-bold text-foreground mb-1">My Stuff</h1>
        <div className="w-10 h-1 bg-accent rounded-full mb-6" />

        {!user ? (
          <div className="py-20 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Sign in to see your purchases.</p>
            <Link to="/auth" className="text-accent hover:underline text-sm mt-2 inline-block">
              Sign In
            </Link>
          </div>
        ) : isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Loading...</div>
        ) : coupons.length === 0 ? (
          <div className="py-20 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No purchases yet.</p>
            <Link to="/" className="text-accent hover:underline text-sm mt-2 inline-block">
              Browse deals
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {coupons.map((coupon: any) => {
              const deal = coupon.deals;
              const status = (coupon.status || "unused") as "used" | "unused" | "expired";
              const isUsed = status === "used";

              return (
                <div
                  key={coupon.id}
                  className="bg-card rounded-xl p-4 flex gap-4 transition-all"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  {/* Deal image */}
                  <img
                    src={deal?.image_url || "/placeholder.svg"}
                    alt={deal?.title}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground line-clamp-1">
                        {deal?.title || "Deal"}
                      </span>

                      {/* USED / UNUSED badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${isUsed
                            ? "bg-muted text-muted-foreground"
                            : "bg-accent/10 text-accent"
                          }`}
                      >
                        {isUsed ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {isUsed ? "USED" : "ACTIVE"}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      {deal?.merchants?.name || deal?.businesses?.name} · {deal?.location}
                    </p>
                    <p className="text-xs text-muted-foreground">Code: {coupon.code}</p>

                    {/* Price + action buttons */}
                    <div className="flex items-center justify-between mt-3 gap-2">
                      <span className="text-sm font-bold text-primary">
                        GH₵{deal?.discounted_price}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* View button */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => navigate(`/voucher/${coupon.id}`)}
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Button>

                        {/* Delete button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deleteCoupon.isPending}
                          onClick={() => {
                            if (confirm("Delete this coupon?")) {
                              deleteCoupon.mutate(coupon.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default MyStuff;
