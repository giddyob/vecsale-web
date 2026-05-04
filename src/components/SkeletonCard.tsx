/**
 * SkeletonCard — animated shimmer placeholder shown while deal data loads.
 * Mirrors the dimensions of DealCard in each variant.
 */

interface SkeletonCardProps {
  variant?: "default" | "large" | "trending";
}

const shimmer =
  "bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]";

const SkeletonCard = ({ variant = "default" }: SkeletonCardProps) => {
  const isLarge = variant === "large";
  const isTrending = variant === "trending";

  const imgHeight = isLarge ? "h-56" : isTrending ? "h-[150px]" : "h-44";

  return (
    <div className="bg-card rounded-lg overflow-hidden shadow-[var(--shadow-card)]">
      {/* Image placeholder */}
      <div className={`${shimmer} w-full ${imgHeight}`} />

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Merchant row */}
        <div className="flex items-center gap-2">
          <div className={`${shimmer} h-3 rounded w-24`} />
          <div className={`${shimmer} h-3 rounded w-10 ml-auto`} />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <div className={`${shimmer} h-4 rounded w-full`} />
          <div className={`${shimmer} h-4 rounded w-3/4`} />
        </div>

        {/* Location */}
        <div className={`${shimmer} h-3 rounded w-28`} />

        {/* Price row */}
        <div className="flex items-center gap-2 pt-1">
          <div className={`${shimmer} h-5 rounded w-16`} />
          <div className={`${shimmer} h-4 rounded w-12`} />
          <div className={`${shimmer} h-5 rounded w-12 ml-auto`} />
        </div>
      </div>
    </div>
  );
};

export default SkeletonCard;
