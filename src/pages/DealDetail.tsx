import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Heart, Star, MapPin, ShoppingCart, Share2, Shield, ChevronLeft, ChevronRight, X } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DealCard from "@/components/DealCard";
import { useDeal, useDeals, useBusiness, useMerchants } from "@/hooks/useDeals";
import type { SubDeal } from "@/hooks/useDeals";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const DealDetail = () => {
  const { id } = useParams();
  const { data: deal, isLoading } = useDeal(id);
  const { data: allDeals = [] } = useDeals();
  const { data: merchantsMap } = useMerchants();
  // Resolve merchant ID: stored on deal, or look up by merchant name in the merchants map
  const resolvedMerchantId =
    deal?.businessId ||
    (deal?.merchant && merchantsMap?.byName[deal.merchant.toLowerCase()]) ||
    undefined;
  const { data: business } = useBusiness(resolvedMerchantId);
  const { data: favIds = [] } = useFavorites();
  const toggleFav = useToggleFavorite();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const isFav = deal ? favIds.includes(deal.id) : false;

  const handleFav = () => {
    if (!user) { toast({ title: "Sign in to save favourites", variant: "destructive" }); return; }
    if (deal) toggleFav.mutate({ dealId: deal.id, isFavorited: isFav });
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background"><Header /><div className="container py-20 text-center text-muted-foreground">Loading...</div><Footer /></div>;
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-4">Deal not found</h1>
          <Link to="/" className="text-accent hover:underline">Back to home</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const related = allDeals.filter((d) => d.category === deal.category && d.id !== deal.id).slice(0, 3);
  const activeSub = deal.subDeals.find((s) => s.id === selectedSub) || null;
  const displayPrice = activeSub ? activeSub.discounted_price : deal.currentPrice;
  const displayOriginal = activeSub ? activeSub.original_price : deal.originalPrice;
  const displayDiscount = activeSub
    ? Math.round(((activeSub.original_price - activeSub.discounted_price) / activeSub.original_price) * 100)
    : deal.discount;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to deals
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {/* Main image — clicking opens lightbox */}
            {(() => {
              const allImages = [deal.image, ...deal.galleryUrls];
              const bigSrc = activeImage || deal.image;
              const bigIndex = allImages.indexOf(bigSrc);
              return (
                <>
                  <div
                    className="relative rounded-xl overflow-hidden aspect-[4/3] cursor-zoom-in"
                    onClick={() => {
                      setLightboxIndex(bigIndex >= 0 ? bigIndex : 0);
                      setLightboxOpen(true);
                    }}
                  >
                    <img src={bigSrc} alt={deal.title} className="w-full h-full object-cover transition-all duration-300" />
                    <span className="absolute top-4 left-4 text-sm font-bold bg-accent text-accent-foreground px-3 py-1 rounded-lg">
                      -{displayDiscount}% OFF
                    </span>
                  </div>

                  {/* Gallery thumbnails — clicking switches the main image only */}
                  {allImages.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {allImages.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImage(url)}
                          className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${bigSrc === url ? "border-accent" : "border-border hover:border-accent/60"
                            }`}
                        >
                          <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Lightbox — opened only by clicking the big image */}
            <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
              <DialogContent className="max-w-4xl p-0 bg-black/95 border-none overflow-hidden">
                {(() => {
                  const allImages = [deal.image, ...deal.galleryUrls];
                  const current = allImages[lightboxIndex] || deal.image;
                  return (
                    <div className="relative flex items-center justify-center min-h-[60vh]">
                      <img src={current} alt={deal.title} className="max-h-[80vh] max-w-full object-contain" />
                      {allImages.length > 1 && (
                        <>
                          <button
                            onClick={() => setLightboxIndex((lightboxIndex - 1 + allImages.length) % allImages.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-2 transition-colors"
                          >
                            <ChevronLeft className="w-6 h-6 text-white" />
                          </button>
                          <button
                            onClick={() => setLightboxIndex((lightboxIndex + 1) % allImages.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-2 transition-colors"
                          >
                            <ChevronRight className="w-6 h-6 text-white" />
                          </button>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {allImages.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setLightboxIndex(i)}
                                className={`w-2 h-2 rounded-full transition-colors ${i === lightboxIndex ? "bg-white" : "bg-white/40"}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </DialogContent>
            </Dialog>

            {/* MOVED: Business Info and Deal Details below image gallery */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-foreground mb-4">About this Deal</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {activeSub?.description || deal.description || `Enjoy an incredible experience with ${deal.merchant}. This exclusive deal gives you ${displayDiscount}% off the regular price.`}
              </p>

              {/* Business Info Row */}
              <div className="flex items-center gap-3 p-4 bg-secondary/50 border border-border rounded-xl">
                {/* Logo / avatar */}
                {(business?.avatarUrl || business?.logo) ? (
                  <img
                    src={business?.avatarUrl || business?.logo}
                    alt={business?.name || deal.merchant}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-border bg-white"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-accent uppercase">
                      {deal.merchant.charAt(0)}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {resolvedMerchantId ? (
                    <Link
                      to={`/business/${resolvedMerchantId}`}
                      className="font-semibold text-base text-accent hover:underline block leading-tight mb-1"
                    >
                      {business?.name || deal.merchant}
                    </Link>
                  ) : (
                    <span className="font-semibold text-base text-accent block leading-tight mb-1">
                      {deal.merchant}
                    </span>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {(business?.location || deal.location) && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        {business?.location || deal.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <Star className="w-3.5 h-3.5 fill-accent text-accent" />
                      {business?.rating ?? deal.rating}
                      {business?.review_count ? (
                        <span className="text-muted-foreground">({business.review_count} reviews)</span>
                      ) : null}
                    </span>
                  </div>
                </div>

                {resolvedMerchantId && (
                  <Link
                    to={`/business/${resolvedMerchantId}`}
                    className="flex-shrink-0 text-sm font-semibold text-accent border border-accent/40 rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors hidden sm:block"
                  >
                    View Profile
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground mb-6">
              {activeSub ? activeSub.title : deal.title}
            </h1>

            {/* Sub-deals moved directly below title */}
            {deal.subDeals.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">Select Option:</p>
                <div className="space-y-3">
                  {deal.subDeals.map((sub: SubDeal) => {
                    const subDiscount = Math.round(((sub.original_price - sub.discounted_price) / sub.original_price) * 100);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)}
                        className={`w-full text-left rounded-xl border-2 p-4 transition-all ${selectedSub === sub.id
                          ? "border-accent bg-accent/5 shadow-md"
                          : "border-border bg-card hover:border-accent/40 hover:shadow-sm"
                          }`}
                      >
                        <h5 className="text-base font-bold text-foreground leading-snug mb-1">
                          {sub.title}
                        </h5>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xl font-extrabold text-foreground">GH₵{sub.discounted_price}</span>
                          <span className="text-muted-foreground line-through text-sm">GH₵{sub.original_price}</span>
                          <span className="text-xs font-bold bg-accent text-accent-foreground px-2 py-0.5 rounded-md ml-auto">
                            -{subDiscount}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-extrabold text-foreground">GH₵{displayPrice}</span>
              <span className="text-lg text-muted-foreground line-through">GH₵{displayOriginal}</span>
              <span className="text-sm font-semibold text-accent">Save GH₵{displayOriginal - displayPrice}</span>
            </div>

            <div className="flex gap-3 mb-6">
              <Link
                to={`/checkout?deal=${deal.id}${activeSub ? `&sub=${activeSub.id}` : ""}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                <ShoppingCart className="w-4 h-4" /> Buy Now
              </Link>
              <button onClick={handleFav} className={`px-4 py-3 rounded-lg border border-border bg-card transition-colors ${isFav ? "text-accent" : "text-muted-foreground hover:text-accent"}`}>
                <Heart className={`w-5 h-5 ${isFav ? "fill-accent" : ""}`} />
              </button>
              <button className="px-4 py-3 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-secondary rounded-lg p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">VecSale Guarantee</p>
                <p className="text-xs text-muted-foreground">Full refund if you're not satisfied. No questions asked.</p>
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-14">
            <h2 className="text-xl font-display font-bold text-foreground mb-1">You Might Also Like</h2>
            <div className="w-10 h-1 bg-accent rounded-full mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {related.map((d) => <DealCard key={d.id} deal={d} />)}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default DealDetail;
