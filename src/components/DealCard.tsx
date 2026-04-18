import { Heart, Star, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { DealWithBusiness } from "@/hooks/useDeals";
import { useMerchants } from "@/hooks/useDeals";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
import { useAuth } from "@/contexts/AuthContext";

interface DealCardProps {
  deal: DealWithBusiness;
  variant?: "default" | "large" | "trending";
}

const DealCard = ({ deal, variant = "default" }: DealCardProps) => {
  const isLarge = variant === "large";
  const isTrending = variant === "trending";
  const { user } = useAuth();
  const { data: favIds = [] } = useFavorites();
  const toggleFav = useToggleFavorite();
  const isFav = favIds.includes(deal.id);

  // Fetch all merchants from Firestore so we can link by name even if deal.businessId is null
  const { data: merchantsMap } = useMerchants();

  // Resolve the merchant's Firestore doc ID:
  // 1. Use deal.businessId set by enrichDealsWithBusiness (most reliable)
  // 2. Fall back to a name-based lookup in the merchants map
  const resolvedMerchantId =
    deal.businessId ||
    (merchantsMap?.byName[deal.merchant?.toLowerCase()] ?? null);

  // Get full merchant profile to show logo/avatar
  const merchantProfile = resolvedMerchantId
    ? merchantsMap?.byId[resolvedMerchantId]
    : null;

  const avatarUrl = deal.avatarUrl || merchantProfile?.avatarUrl || merchantProfile?.logo || null;

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    toggleFav.mutate({ dealId: deal.id, isFavorited: isFav });
  };

  return (
    <Link
      to={`/deal/${deal.id}`}
      className="group block bg-card rounded-lg overflow-hidden transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div 
        className={`relative overflow-hidden ${isLarge ? "h-56" : isTrending ? "flex justify-center" : "h-44"}`}
        style={isTrending ? { height: "150.19px" } : {}}
      >
        <img
          src={deal.image}
          alt={deal.title}
          className={`object-cover group-hover:scale-105 transition-transform duration-500 ${isTrending ? "" : "w-full h-full"}`}
          style={isTrending ? { width: "267px", height: "150.19px" } : {}}
          loading="lazy"
        />
        <button
          onClick={handleFav}
          className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-card/80 backdrop-blur-sm transition-colors ${isFav ? "text-accent" : "text-muted-foreground hover:text-accent"}`}
        >
          <Heart className={`w-4 h-4 ${isFav ? "fill-accent" : ""}`} />
        </button>
      </div>

      <div className="p-4">
        {/* Merchant row */}
        {/* Merchant row */}
        <div className="flex items-center gap-2 mb-2">
          {/* Merchant name — always a link if we can resolve an ID */}
          {resolvedMerchantId ? (
            <Link
              to={`/business/${resolvedMerchantId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted-foreground truncate hover:underline"
            >
              {merchantProfile?.name || deal.merchant}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground truncate">
              {deal.merchant}
            </span>
          )}

          {/* Rating pushed to right */}
          <span className="flex items-center gap-0.5 text-foreground ml-auto text-xs flex-shrink-0">
            <Star className="w-3.5 h-3.5 fill-accent text-accent" />
            {merchantProfile?.rating ?? deal.rating}
          </span>
        </div>

        <h3 className="font-display font-semibold text-base text-foreground leading-tight mb-2 line-clamp-2">
          {deal.title}
        </h3>

        {/* Location moved below title */}
        {(deal.location || merchantProfile?.location) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{deal.location || merchantProfile?.location}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">
            GH₵{deal.currentPrice}
          </span>
          <span className="text-sm text-muted-foreground line-through">
            GH₵{deal.originalPrice}
          </span>
          <span className="ml-auto text-xs font-bold bg-discount text-discount-foreground px-2 py-0.5 rounded-md">
            -{deal.discount}%
          </span>
        </div>
      </div>
    </Link>
  );
};

export default DealCard;
