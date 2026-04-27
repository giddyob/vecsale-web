import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import IdleTimeoutModal from "@/components/IdleTimeoutModal";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DealDetail from "./pages/DealDetail";
import BusinessProfile from "./pages/BusinessProfile";
import Checkout from "./pages/Checkout";
import Category from "./pages/Category";
import Auth from "./pages/Auth";
import MyStuff from "./pages/MyStuff";
import Favourites from "./pages/Favourites";
import Cart from "./pages/Cart";
import Voucher from "./pages/Voucher";
import MerchantSignup from "./pages/MerchantSignup";
import SearchPage from "./pages/Search";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <IdleTimeoutModal />
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/deal/:id" element={<DealDetail />} />
              <Route path="/voucher/:id" element={<Voucher />} />
              <Route path="/business/:id" element={<BusinessProfile />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/category/:name" element={<Category />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/my-stuff" element={<MyStuff />} />
              <Route path="/favourites" element={<Favourites />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/merchant" element={<MerchantSignup />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
