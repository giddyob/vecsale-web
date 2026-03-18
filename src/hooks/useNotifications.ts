import { useQuery } from "@tanstack/react-query";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCallback, useState } from "react";

export interface DealNotification {
    id: string;
    dealId: string;
    title: string;
    merchant: string;
    imageUrl: string;
    category: string;
    discountedPrice: number;
    discountPercentage: number;
    createdAt: string;
}

const STORAGE_KEY = "vecsale_dismissed_notifications";
const SEEN_KEY = "vecsale_seen_notifications";

function getDismissed(): string[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
        return [];
    }
}

function getSeen(): string[] {
    try {
        return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    } catch {
        return [];
    }
}

export function useNotifications() {
    const [dismissed, setDismissed] = useState<string[]>(getDismissed);
    const [seen, setSeen] = useState<string[]>(getSeen);

    // Fetch latest deals from the past 30 days as notifications
    const { data: rawDeals = [] } = useQuery({
        queryKey: ["notifications-deals"],
        queryFn: async () => {
            const since = new Date();
            since.setDate(since.getDate() - 30);
            const sinceIso = since.toISOString();

            // Fetch all deals; filter + sort client-side to avoid composite index requirement
            const q = query(collection(db, "deals"));
            const querySnapshot = await getDocs(q);

            const activeDocs = querySnapshot.docs.filter(d => {
                const data = d.data();
                const status = data.status;
                const createdAt = data.created_at || "";
                const isActive = !status || status === "active";
                const isRecent = !createdAt || createdAt >= sinceIso;
                return isActive && isRecent;
            }).slice(0, 30); // limit 30

            // Pre-fetch merchants to build name map for fallback lookup
            const merchantsSnap = await getDocs(collection(db, "merchants"));
            const merchantNameMap: Record<string, any> = {};
            merchantsSnap.forEach((docSnap) => {
                const d = docSnap.data();
                if (d.name) merchantNameMap[d.name.toLowerCase().trim()] = d;
            });

            const dealsPromises = activeDocs.map(async (docSnap) => {
                const dealData = docSnap.data();
                let businessData = null;

                const getStrId = (val: any) => typeof val === "string" ? val : val?.id || val?.path?.split('/')?.pop();
                
                let refId = getStrId(dealData.merchantId) ||
                            getStrId(dealData.merchants) || 
                            getStrId(dealData.merchant_id) || 
                            getStrId(dealData.merchants_id) || 
                            getStrId(dealData.business_id) ||
                            getStrId(dealData.businesses);

                if (!refId && typeof dealData.merchant === "string") {
                    if (!dealData.merchant.includes(" ") && dealData.merchant.length >= 8) {
                        refId = dealData.merchant;
                    }
                }

                if (refId) {
                    const merchantRef = doc(db, "merchants", refId);
                    const merchantSnap = await getDoc(merchantRef);
                    if (merchantSnap.exists()) {
                        businessData = merchantSnap.data();
                    }
                }

                // Fallback: match by merchant name
                if (!businessData) {
                    const merchantName = dealData.merchant || dealData.merchants?.name || dealData.businesses?.name;
                    if (merchantName && typeof merchantName === "string") {
                        businessData = merchantNameMap[merchantName.toLowerCase().trim()] || null;
                    }
                }

                return {
                    id: docSnap.id,
                    ...dealData,
                    merchants: businessData ? { name: businessData.name } : (dealData.merchants || dealData.businesses || null)
                };
            });

            return await Promise.all(dealsPromises);
        },
        refetchInterval: 60_000, // refresh every minute
        staleTime: 30_000,
    });

    const notifications: DealNotification[] = (rawDeals as any[])
        .filter((d) => !dismissed.includes(d.id))
        .map((d) => ({
            id: d.id,
            dealId: d.id,
            title: d.title,
            merchant: d.merchants?.name || "Local Merchant",
            imageUrl: d.image_url || "/placeholder.svg",
            category: d.category || "",
            discountedPrice: Number(d.discounted_price),
            discountPercentage: d.discount_percentage || 0,
            createdAt: d.created_at,
        }));

    const unreadCount = notifications.filter((n) => !seen.includes(n.id)).length;

    const markAllSeen = useCallback(() => {
        const ids = notifications.map((n) => n.id);
        const updated = Array.from(new Set([...getSeen(), ...ids]));
        localStorage.setItem(SEEN_KEY, JSON.stringify(updated));
        setSeen(updated);
    }, [notifications]);

    const dismiss = useCallback((id: string) => {
        const updated = [...getDismissed(), id];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setDismissed(updated);
        // Also mark as seen
        const updatedSeen = Array.from(new Set([...getSeen(), id]));
        localStorage.setItem(SEEN_KEY, JSON.stringify(updatedSeen));
        setSeen(updatedSeen);
    }, []);

    const dismissAll = useCallback(() => {
        const ids = notifications.map((n) => n.id);
        const updated = Array.from(new Set([...getDismissed(), ...ids]));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setDismissed(updated);
    }, [notifications]);

    return { notifications, unreadCount, markAllSeen, dismiss, dismissAll };
}
