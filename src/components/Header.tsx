
import { Search, Heart, ShoppingCart, User, LogOut, Menu, Package, Ticket, Sparkles, UtensilsCrossed, Dumbbell, ShoppingBag, Plane, Car, Gift } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { categories, categoryIconNames } from "@/data/deals";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/hooks/useFavorites";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import vecsaleLogo from "@/assets/vecsale_Logo__mobile_view.png";
import vecsaleLogoDesktop from "@/assets/vecsale-logo.png";
import NotificationDropdown from "@/components/NotificationDropdown";

const iconMap: Record<string, React.ComponentType<{ className?: string; }>> = {
  Ticket, Sparkles, UtensilsCrossed, Dumbbell, ShoppingBag, Plane, Car, Gift
};

const getInitials = (email: string) => {
  const parts = email.split("@")[0].split(/[._\-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
};

/* ── Account dropdown (logged-in users only) ── */
const AccountDropdown = ({
  initials,
  onSignOut,
}: {
  initials: string;
  onSignOut: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const menuItems = [
    { to: "/my-stuff", icon: <Package className="w-4 h-4" />, label: "My Stuff" },
    { to: "/favourites", icon: <Heart className="w-4 h-4" />, label: "Favourites" },
    { to: "/profile", icon: <User className="w-4 h-4" />, label: "Profile" },
  ];

  return (
    <div className="relative" ref={ref}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold flex-shrink-0 hover:opacity-90 transition-opacity select-none"
        aria-label="Account menu"
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 mt-3 bg-white rounded-xl shadow-2xl border border-border z-50 overflow-hidden"
          style={{ minWidth: 200 }}
        >
          {/* User label */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted-foreground">Logged in as</p>
            <p
              className="text-sm font-bold mt-0.5"
              style={{ color: "#F35F20" }}
            >
              {initials}
            </p>
          </div>

          {/* Nav links */}
          <nav className="py-1">
            {menuItems.map(({ to, icon, label }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <span className="text-muted-foreground">{icon}</span>
                {label}
              </Link>
            ))}
          </nav>

          {/* Sign out */}
          <div className="border-t border-border py-1">
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Header = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { user, signOut } = useAuth();
  const { itemCount } = useCart();
  const { data: favIds = [] } = useFavorites();
  const favCount = favIds.length;
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(e as unknown as React.FormEvent);
    }
  };

  const initials = user?.email ? getInitials(user.email) : "";

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-nav border-b border-border">
        <div className="container flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger — larger, black */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="md:hidden text-black hover:text-black/70 transition-colors">
                  <Menu className="w-8 h-8" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="p-4 border-b border-border">
                  <SheetTitle className="text-left">
                    <img
                      src={vecsaleLogoDesktop}
                      alt="VecSale"
                      style={{ width: 168.06, height: 40 }}
                    />
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col p-4 gap-1">
                  {user &&
                    <>
                      <Link to="/my-stuff" className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                        <Package className="w-4 h-4" />
                        My Stuff
                      </Link>
                      <Link to="/cart" className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                        <ShoppingCart className="w-4 h-4" />
                        Cart
                        {itemCount > 0 &&
                          <span className="ml-auto bg-accent text-accent-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {itemCount}
                          </span>
                        }
                      </Link>
                      <Link to="/favourites" className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                        <Heart className="w-4 h-4" />
                        Favourites
                      </Link>
                      <Link to="/auth" className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                        <User className="w-4 h-4" />
                        Profile
                      </Link>
                    </>
                  }

                  {!user &&
                    <Link to="/auth" className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                      <User className="w-4 h-4" />
                      Sign In
                    </Link>
                  }

                  <div className="border-t border-border my-3" />
                  <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Categories</p>
                  {categories.map((cat) => {
                    const IconComp = iconMap[categoryIconNames[cat]];
                    return (
                      <Link
                        key={cat}
                        to={`/category/${encodeURIComponent(cat)}`}
                        className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">

                        {IconComp && <IconComp className="w-4 h-4" />}
                        {cat}
                      </Link>);

                  })}

                  {user &&
                    <>
                      <div className="border-t border-border my-3" />
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-left text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">

                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </>
                  }
                </nav>
              </SheetContent>
            </Sheet>

            <a href="/" className="flex-shrink-0">
              <img alt="VecSale" className="hidden md:block" style={{ width: 168.06, height: 40 }} src={vecsaleLogoDesktop} />
              <img
                alt="VecSale"
                className="md:hidden"
                style={{ width: 50, height: 32 }}
                src={vecsaleLogo}
              />
            </a>
          </div>

          {/* Desktop search — Groupon pill style */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl">
            <div
              className="flex w-full items-center bg-white"
              style={{
                border: "2px solid hsl(var(--accent))",
                borderRadius: "9999px",
                height: 48,
                overflow: "hidden",
              }}
            >
              <input
                type="text"
                placeholder="Search local deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1 px-5 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-85"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "hsl(var(--accent))",
                  marginRight: 4,
                }}
                aria-label="Search"
              >
                <Search className="w-4 h-4 text-white" />
              </button>
            </div>
          </form>

          {/* Right-side icon cluster — all icons share the same flex row and baseline */}
          <div className="flex items-center gap-4">
            {/* Notifications — bell always visible; guest state handled inside dropdown */}
            <div className="flex items-center">
              <NotificationDropdown />
            </div>

            {/* Favourites with count badge */}
            <Link to="/favourites" className="relative text-black hover:text-black/70 transition-colors">
              <Heart className="w-6 h-6" />
              {favCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {favCount > 99 ? "99+" : favCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <Link to="/cart" className="relative text-black hover:text-black/70 transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Profile avatar / dropdown */}
            {user ? (
              <AccountDropdown
                initials={initials}
                onSignOut={handleSignOut}
              />
            ) : (
              <Link
                to="/auth"
                className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center flex-shrink-0 hover:bg-black/5 transition-colors"
              >
                <User className="w-4 h-4 text-black" />
              </Link>
            )}
          </div>
        </div>

        {/* Mobile search — Groupon pill style */}
        <div className="md:hidden px-4 pb-3">
          <form onSubmit={handleSearch}>
            <div
              className="flex w-full items-center bg-white"
              style={{
                border: "2px solid hsl(var(--accent))",
                borderRadius: "9999px",
                height: 44,
                overflow: "hidden",
              }}
            >
              <input
                type="text"
                placeholder="Search local deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1 px-4 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-85"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "hsl(var(--accent))",
                  marginRight: 4,
                }}
                aria-label="Search"
              >
                <Search className="w-4 h-4 text-white" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Desktop category nav */}
      <div className="hidden md:block bg-card border-b border-border">
        <div className="container">
          <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
            {categories.map((cat) => {
              const IconComp = iconMap[categoryIconNames[cat]];
              return (
                <Link
                  key={cat}
                  to={`/category/${encodeURIComponent(cat)}`}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium hover:bg-secondary rounded-md transition-colors text-neutral-950">

                  {IconComp && <IconComp className="w-4 h-4" />}
                  {cat}
                </Link>);

            })}
          </nav>
        </div>
      </div>
    </header>);

};

export default Header;
