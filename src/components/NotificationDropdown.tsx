import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, X, Tag, Lock, Trash2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

const NotificationDropdown = () => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { user } = useAuth();
    const { notifications, unreadCount, markAllSeen, dismiss, dismissAll } = useNotifications();

    // Mark all as seen when dropdown opens
    useEffect(() => {
        if (open) markAllSeen();
    }, [open, markAllSeen]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            {/* Bell trigger */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="relative text-black hover:text-black/70 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-6 h-6" />
                {/* Only show badge for authenticated users with unread notifications */}
                {user && unreadCount > 0 && (
                    <span
                        className="absolute -top-2 -right-2 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                        style={{
                            minWidth: 18,
                            height: 18,
                            backgroundColor: "#1B5E20",
                            padding: "0 4px",
                        }}
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    className="fixed left-0 right-0 top-[106px] md:absolute md:top-auto md:left-auto md:right-0 md:w-[360px] md:mt-3 md:rounded-xl bg-white shadow-2xl border border-border z-50 flex flex-col"
                    style={{ maxHeight: 520 }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-foreground" />
                            <span className="font-display font-bold text-sm text-foreground">
                                Notifications
                            </span>
                            {notifications.length > 0 && (
                                <span
                                    className="text-white text-[10px] font-bold rounded-full px-1.5 py-0.5"
                                    style={{ backgroundColor: "#1B5E20" }}
                                >
                                    {notifications.length}
                                </span>
                            )}
                        </div>
                        {notifications.length > 0 && (
                            <button
                                onClick={dismissAll}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {/* Guest state — not signed in */}
                        {!user ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <div
                                    className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                                    style={{ backgroundColor: "rgba(27, 94, 32, 0.1)" }}
                                >
                                    <Lock className="w-6 h-6" style={{ color: "#1B5E20" }} />
                                </div>
                                <p className="text-sm font-semibold text-foreground">Sign in to see deals</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Create a free account to get notified about the latest local deals.
                                </p>
                                <Link
                                    to="/auth"
                                    onClick={() => setOpen(false)}
                                    className="mt-4 text-xs font-bold px-4 py-1.5 rounded-full text-white transition-opacity hover:opacity-80"
                                    style={{ backgroundColor: "#1B5E20" }}
                                >
                                    Sign In / Register
                                </Link>
                            </div>
                        ) : notifications.length === 0 ? (
                            /* Authenticated but no new notifications yet */
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <div
                                    className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                                    style={{ backgroundColor: "rgba(27, 94, 32, 0.1)" }}
                                >
                                    <Bell className="w-6 h-6" style={{ color: "#1B5E20" }} />
                                </div>
                                <p className="text-sm font-semibold text-foreground">You're all caught up!</p>
                                <p className="text-xs text-muted-foreground mt-1">New deals will appear here.</p>
                            </div>
                        ) : (
                            /* Authenticated with notifications */
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors group border-b border-border last:border-0"
                                >
                                    {/* Deal image */}
                                    <div className="relative flex-shrink-0">
                                        <img
                                            src={n.imageUrl}
                                            alt={n.title}
                                            className="w-12 h-12 rounded-lg object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = "/placeholder.svg";
                                            }}
                                        />
                                        <span
                                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                            style={{ backgroundColor: "#1B5E20" }}
                                        >
                                            <Tag className="w-2.5 h-2.5 text-white" />
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                                            {n.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{n.merchant}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span
                                                className="text-xs font-bold"
                                                style={{ color: "#1B5E20" }}
                                            >
                                                GH₵{n.discountedPrice}
                                            </span>
                                            {n.discountPercentage > 0 && (
                                                <span
                                                    className="text-[10px] font-bold text-white rounded px-1 py-0.5"
                                                    style={{ backgroundColor: "#E65100" }}
                                                >
                                                    -{n.discountPercentage}%
                                                </span>
                                            )}
                                            <span className="text-[10px] text-muted-foreground ml-auto">
                                                {timeAgo(n.createdAt)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={() => dismiss(n.id)}
                                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            aria-label="Dismiss"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                        <Link
                                            to={`/deal/${n.dealId}`}
                                            onClick={() => setOpen(false)}
                                            className="text-[10px] font-bold px-2 py-0.5 rounded transition-opacity hover:opacity-80 text-white"
                                            style={{ backgroundColor: "#1B5E20" }}
                                        >
                                            View
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer — only for authenticated users with notifications */}
                    {user && notifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-border flex-shrink-0 text-center">
                            <p className="text-xs text-muted-foreground">
                                Showing new deals since you joined
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
