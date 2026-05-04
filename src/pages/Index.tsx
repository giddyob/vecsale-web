import Header from "@/components/Header";
import TrendingSection from "@/components/TrendingSection";
import DealsGrid from "@/components/DealsGrid";
import CategoryCards from "@/components/CategoryCards";
import Footer from "@/components/Footer";
import { useDeals } from "@/hooks/useDeals";
import heroBg from "@/assets/2v-3300x1260.webp";

/* ── shimmer base classes (Tailwind + custom keyframe in index.css) ── */
const shimmer =
  "bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite] rounded";

/* Single skeleton card */
function SkeletonDealCard({ imgHeight }: { imgHeight: string }) {
  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100">
      <div className={`${shimmer} w-full ${imgHeight}`} style={{ borderRadius: 0 }} />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={`${shimmer} h-3 w-24`} />
          <div className={`${shimmer} h-3 w-10 ml-auto`} />
        </div>
        <div className="space-y-1.5">
          <div className={`${shimmer} h-4 w-full`} />
          <div className={`${shimmer} h-4 w-3/4`} />
        </div>
        <div className={`${shimmer} h-3 w-28`} />
        <div className="flex items-center gap-2 pt-1">
          <div className={`${shimmer} h-5 w-16`} />
          <div className={`${shimmer} h-4 w-10`} />
          <div className={`${shimmer} h-5 w-12 ml-auto`} />
        </div>
      </div>
    </div>
  );
}

/* Section title placeholder */
function SkeletonTitle() {
  return (
    <div className="mb-6">
      <div className={`${shimmer} h-7 w-44`} />
      <div className={`${shimmer} h-1 w-12 mt-2`} />
    </div>
  );
}

/* Full-page skeleton that mirrors the real layout */
function SkeletonLayout() {
  return (
    <>
      {/* Trending row */}
      <section className="pt-4 pb-10">
        <div className="container">
          <div className="mb-6">
            <div className={`${shimmer} h-7 w-40`} />
            <div className={`${shimmer} h-1 w-12 mt-2`} />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[260px]">
                <SkeletonDealCard imgHeight="h-[150px]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Handpicked — 2-col grid */}
      <section className="pt-4 pb-10">
        <div className="container">
          <SkeletonTitle />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonDealCard key={i} imgHeight="h-56" />
            ))}
          </div>
        </div>
      </section>

      {/* More discoveries — 3-col grid */}
      <section className="pt-4 pb-10">
        <div className="container">
          <SkeletonTitle />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonDealCard key={i} imgHeight="h-44" />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* ── Main page ── */
const Index = () => {
  const { data: deals = [], isLoading, isError, error } = useDeals();

  if (error) console.error("[useDeals] Firebase error:", error);

  const trending   = deals.slice(0, 7);
  const handpicked = deals.slice(7, 11);
  const more       = deals.slice(11);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero banner */}
      <div className="relative w-full overflow-visible" style={{ backgroundColor: "#017C1f" }}>
        <img
          src={heroBg}
          alt="Hero banner"
          className="object-cover object-center block mx-auto"
          style={{ width: "1650px", height: "630px", maxWidth: "100%" }}
        />

        {/* Floating content card */}
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
            <SkeletonLayout />
          ) : isError ? (
            <div className="container py-20 text-center text-red-500">
              Failed to load deals. Please check your connection and try again.
            </div>
          ) : (
            <>
              <TrendingSection deals={trending} />
              {handpicked.length > 0 && (
                <DealsGrid title="Handpicked for You" deals={handpicked} columns={2} />
              )}
              {more.length > 0 && (
                <DealsGrid title="More Discoveries" deals={more} columns={3} />
              )}
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
