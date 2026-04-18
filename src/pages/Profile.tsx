import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft, User, Mail, Edit2, Check, X, LogOut,
    Package, Heart, ShoppingCart, Shield, ChevronRight,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

function getInitials(email: string, fullName?: string) {
    if (fullName) {
        const parts = fullName.trim().split(" ");
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return parts[0].slice(0, 2).toUpperCase();
    }
    const parts = email.split("@")[0].split(/[._\-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
}

const GREEN = "#1B5E20";

const Profile = () => {
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const currentName: string = user?.displayName || "";
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(currentName);
    const [savingName, setSavingName] = useState(false);

    if (!user) {
        navigate("/auth");
        return null;
    }

    const initials = getInitials(user.email || "", currentName);
    const joinedDate = user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
    }) : "Recently";

    const handleSaveName = async () => {
        if (!nameInput.trim()) return;
        setSavingName(true);
        if (auth.currentUser) {
           try {
              await updateProfile(auth.currentUser, {
                 displayName: nameInput.trim()
              });
              toast({ title: "Display name updated!" });
              setEditingName(false);
           } catch (error: any) {
              toast({ title: "Update failed", description: error.message, variant: "destructive" });
           }
        }
        setSavingName(false);
    };

    const handleSignOut = async () => {
        await signOut();
        navigate("/");
    };

    const quickLinks = [
        { to: "/my-stuff", icon: <Package className="w-5 h-5" />, label: "My Coupons", desc: "View your purchased deals" },
        { to: "/favourites", icon: <Heart className="w-5 h-5" />, label: "Favourites", desc: "Deals you've saved" },
        { to: "/cart", icon: <ShoppingCart className="w-5 h-5" />, label: "Cart", desc: "Items ready to purchase" },
    ];

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <div className="container py-8 max-w-2xl">
                {/* Back */}
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to home
                </Link>

                {/* Avatar card */}
                <div
                    className="bg-card rounded-2xl p-8 mb-6 text-center relative overflow-hidden"
                    style={{ boxShadow: "var(--shadow-card)" }}
                >
                    {/* Decorative top band */}
                    <div
                        className="absolute top-0 left-0 right-0 h-24 opacity-10 rounded-t-2xl"
                        style={{ background: `linear-gradient(135deg, ${GREEN}, hsl(140 65% 45%))` }}
                    />

                    {/* Avatar circle */}
                    <div
                        className="relative mx-auto w-24 h-24 rounded-full flex items-center justify-center text-2xl font-display font-bold text-white shadow-lg mb-4"
                        style={{ background: `linear-gradient(135deg, ${GREEN}, hsl(140 65% 45%))` }}
                    >
                        {initials}
                    </div>

                    {/* Display name / editor */}
                    {editingName ? (
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <input
                                autoFocus
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                                className="border border-border rounded-lg px-3 py-1.5 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                                placeholder="Your display name"
                            />
                            <button
                                onClick={handleSaveName}
                                disabled={savingName}
                                className="text-white rounded-lg p-1.5 disabled:opacity-50 transition-opacity hover:opacity-80"
                                style={{ backgroundColor: GREEN }}
                            >
                                <Check className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => { setEditingName(false); setNameInput(currentName); }}
                                className="text-muted-foreground rounded-lg p-1.5 border border-border hover:bg-secondary transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <h1 className="text-xl font-display font-bold text-foreground">
                                {currentName || "VecSale User"}
                            </h1>
                            <button
                                onClick={() => setEditingName(true)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Edit name"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    <p className="text-sm text-muted-foreground">Member since {joinedDate}</p>
                </div>

                {/* Account info */}
                <div
                    className="bg-card rounded-2xl p-6 mb-6"
                    style={{ boxShadow: "var(--shadow-card)" }}
                >
                    <h2 className="font-display font-bold text-foreground mb-4">Account Details</h2>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: "hsl(120 60% 41% / 0.1)" }}
                            >
                                <Mail className="w-4 h-4" style={{ color: GREEN }} />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Email address</p>
                                <p className="text-sm font-semibold text-foreground">{user.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: "hsl(120 60% 41% / 0.1)" }}
                            >
                                <User className="w-4 h-4" style={{ color: GREEN }} />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Display name</p>
                                <p className="text-sm font-semibold text-foreground">{currentName || "Not set"}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: "hsl(120 60% 41% / 0.1)" }}
                            >
                                <Shield className="w-4 h-4" style={{ color: GREEN }} />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Account status</p>
                                <span
                                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: GREEN }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                                    Verified
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick links */}
                <div
                    className="bg-card rounded-2xl overflow-hidden mb-6"
                    style={{ boxShadow: "var(--shadow-card)" }}
                >
                    <div className="px-6 py-4 border-b border-border">
                        <h2 className="font-display font-bold text-foreground">My Activity</h2>
                    </div>
                    {quickLinks.map(({ to, icon, label, desc }, i) => (
                        <Link
                            key={label}
                            to={to}
                            className={`flex items-center gap-4 px-6 py-4 hover:bg-secondary transition-colors ${i < quickLinks.length - 1 ? "border-b border-border" : ""}`}
                        >
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: "hsl(120 60% 41% / 0.1)", color: GREEN }}
                            >
                                {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground">{label}</p>
                                <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </Link>
                    ))}
                </div>

                {/* Sign out */}
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border-2 border-destructive text-destructive hover:bg-destructive/5 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
            <Footer />
        </div>
    );
};

export default Profile;
