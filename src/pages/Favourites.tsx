import { Link } from "react-router-dom";
import { ArrowLeft, Heart } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DealCard from "@/components/DealCard";
import { useFavoriteDeals } from "@/hooks/useFavorites";
import { useAuth } from "@/contexts/AuthContext";
import type { DealWithBusiness } from "@/hooks/useDeals";

const Favourites = () => {
  const { user } = useAuth();
  const { data: favData = [], isLoading } = useFavoriteDeals();

  // useFavoriteDeals returns [{ deal_id, deals: rawDealObject }]
  // The deals object already has merchants populated — use mapDeal to build DealWithBusiness
  const deals: DealWithBusiness[] = favData
    .filter((f: any) => f.deals)
    .map((f: any) => {
      const d = f.deals;
      return {
        id: d.id,
        title: d.title,
        image: d.image_url || "/placeholder.svg",
        merchant: d.merchants?.name || "Local Merchant",
        location: d.merchants?.location || d.location || "",
        rating: d.merchants?.rating || 4.5,
        currentPrice: Number(d.discounted_price),
        originalPrice: Number(d.original_price),
        discount: d.discount_percentage,
        category: d.category,
        description: d.description,
        businessId: d.merchants?.id || d.business_id || null,
        avatarUrl: d.merchants?.avatarUrl || d.merchants?.logo || null,
        galleryUrls: [],
        subDeals: [],
      };
    });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <Heart className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-display font-bold text-foreground">Favourites</h1>
        </div>
        <div className="w-10 h-1 bg-accent rounded-full mb-6" />

        {!user ? (
          <div className="py-20 text-center">
            <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Sign in to save your favourites.</p>
            <Link to="/auth" className="text-accent hover:underline text-sm mt-2 inline-block">Sign In</Link>
          </div>
        ) : isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Loading...</div>
        ) : deals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {deals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
          </div>
        ) : (
          <div className="py-20 text-center">
            <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No favourites yet.</p>
            <Link to="/" className="text-accent hover:underline text-sm mt-2 inline-block">Discover deals</Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Favourites;
