import heroBanner from "@/assets/hero-banner.jpg";

const HeroBanner = () => {
  return (
    <section className="relative h-48 md:h-56 overflow-hidden">
      <img
        src={heroBanner}
        alt="Lifestyle banner"
        className="absolute inset-0 w-full h-full object-cover" />

      <div className="absolute inset-0 bg-black/50" />
      <div className="relative container h-full flex flex-col justify-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/20 border border-white/30 rounded-full px-3 py-1 w-fit mb-3"> Exclusives

        </span>
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-white leading-tight">
          Unlock the{" "}
          <span>Extraordinary.</span>
        </h1>
        <a
          href="#deals"
          className="mt-4 inline-flex items-center px-5 py-2 text-sm font-semibold bg-white text-black rounded-lg hover:bg-slate-100 transition-colors w-fit">

          Hot Deals
        </a>
      </div>
    </section>);

};

export default HeroBanner;