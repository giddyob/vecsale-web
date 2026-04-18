import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";

const Cart = () => {
  const { items, updateQty, removeItem, total } = useCart();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <ShoppingCart className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-display font-bold text-foreground">Cart</h1>
          <span className="text-sm text-muted-foreground">({items.length} item{items.length !== 1 ? "s" : ""})</span>
        </div>
        <div className="w-10 h-1 bg-accent rounded-full mb-6" />

        {items.length > 0 ? (
          <>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={`${item.id}__${item.optionId ?? ""}`} className="bg-card rounded-xl p-4 flex gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
                  <img src={item.image} alt={item.title} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Link to={`/deal/${item.id}`} className="text-sm font-semibold text-foreground hover:text-accent transition-colors line-clamp-1">
                      {item.optionTitle || item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.merchant}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.id, -1, item.optionId)} className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-semibold text-foreground w-6 text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1, item.optionId)} className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-primary">GH₵{item.currentPrice * item.qty}</span>
                      <button onClick={() => removeItem(item.id, item.optionId)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-xl p-6 mt-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Subtotal</span><span className="font-bold text-primary">GH₵{total}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground text-base pt-2 border-t border-border">
                <span>Total</span><span className="text-primary">GH₵{total}</span>
              </div>
              <Link
                to={`/checkout?deal=${items[0]?.id}`}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                Proceed to Checkout
              </Link>
            </div>
          </>
        ) : (
          <div className="py-20 text-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Your cart is empty.</p>
            <Link to="/" className="text-accent hover:underline text-sm mt-2 inline-block">Start shopping</Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Cart;
