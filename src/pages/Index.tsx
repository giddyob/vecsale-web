import Header from "@/components/Header";
import TrendingSection from "@/components/TrendingSection";
import DealsGrid from "@/components/DealsGrid";
import CategoryCards from "@/components/CategoryCards";
import Footer from "@/components/Footer";
import { useDeals } from "@/hooks/useDeals";
import heroBg from "@/assets/2v-3300x1260.webp";

const Index = () => {
  const { data: deals = [], isLoading, isError, error } = useDeals();

  if (error) console.error("[useDeals] Firebase error:", error);

  const trending = deals.slice(0, 7);
  const handpicked = deals.slice(7, 11);
  const more = deals.slice(11);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero background image section */}
      <div className="relative w-full overflow-visible" style={{ backgroundColor: '#017C1f' }}>
        <img
          src={heroBg}
          alt="Hero banner"
          className="object-cover object-center block mx-auto"
          style={{ width: "1650px", height: "630px", maxWidth: "100%" }}
        />

        {/* Deals card floating on top of the image */}
        <div
          className="deals-category-wrapper"
          style={{
            position: "relative",
            background: "lab(100 0 0)",
            margin: "-450px clamp(0px, calc((100vw - 768px) * 0.04563), 30.667px) 0px",
            padding: "16px 0px 0px",
            borderRadius: "12px 12px 0 0",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
            zIndex: 10,
          }}
        >
          {isLoading ? (
            <div className="container py-20 text-center text-muted-foreground">Loading deals...</div>
          ) : isError ? (
            <div className="container py-20 text-center text-red-500">
              Failed to load deals. Please check your connection and try again.
            </div>
          ) : (
            <>
              <TrendingSection deals={trending} />
              {handpicked.length > 0 && <DealsGrid title="Handpicked for You" deals={handpicked} columns={2} />}
              {more.length > 0 && <DealsGrid title="More Discoveries" deals={more} columns={3} />}
            </>
          )}
          <CategoryCards />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
