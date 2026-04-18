import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DealCard from "./DealCard";
import type { DealWithBusiness } from "@/hooks/useDeals";

interface TrendingSectionProps {
  deals: DealWithBusiness[];
}

const TrendingSection = ({ deals }: TrendingSectionProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const updateScroll = () => {
    if (scrollRef.current) {
      setCanScrollLeft(scrollRef.current.scrollLeft > 0);
    }
  };

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
    setTimeout(updateScroll, 350);
  };

  return (
    <section id="deals" className="pt-4 pb-10">
      <div className="container">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              Trending Now
            </h2>
            <div className="w-12 h-1 bg-accent rounded-full mt-1" />
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">
              Top {deals.length} picks
            </span>
            <span>|</span>
            <span>Click arrows or swipe</span>
          </div>
        </div>

        <div className="relative">
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-lg flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div
            ref={scrollRef}
            onScroll={updateScroll}
            className="flex gap-4 overflow-x-auto scroll-smooth scrollbar-hide pb-2"
          >
            {deals.map((deal) => (
              <div key={deal.id} className="flex-shrink-0 w-[260px]">
                <DealCard deal={deal} variant="trending" />
              </div>
            ))}
          </div>

          <button
            onClick={() => scroll("right")}
            className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-lg flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default TrendingSection;
