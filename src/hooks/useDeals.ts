import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SubDeal {
  id: string;
  title: string;
  description?: string;
  original_price: number;
  discounted_price: number;
  vouchers_available?: number;
  location?: string;
  expiry_date?: string;
  redemption_rules?: string;
}

export interface DealWithBusiness {
  id: string;
  title: string;
  image: string;
  merchant: string;
  location: string;
  rating: number;
  currentPrice: number;
  originalPrice: number;
  discount: number;
  category: string;
  description: string | null;
  businessId: string | null;
  avatarUrl: string | null;
  subDeals: SubDeal[];
  galleryUrls: string[];
}

function parseSubDeals(raw: any): SubDeal[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((s: any) => typeof s === "string" ? JSON.parse(s) : s)
      .filter((s: any) => s && s.title)
      .map((s: any) => ({
        ...s,
        id: s.id || Math.random().toString(36).substring(2, 11) // Guarantee an ID for state tracking
      }));
  } catch { return []; }
}

function parseGalleryUrls(raw: any): string[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((u: any) => {
      // In case the URL itself was double JSON-stringified
      if (typeof u === "string" && u.startsWith('"') && u.endsWith('"')) {
        try { return JSON.parse(u); } catch { return u; }
      }
      return u;
    }).filter((u: any) => typeof u === "string" && u.length > 0);
  } catch { return []; }
}

export function mapDeal(deal: any, businessOverrides?: any): DealWithBusiness {
  const merchantName = businessOverrides?.name || deal.merchants?.name || deal.businesses?.name || deal.merchant || "Local Merchant";
  const merchantRating = businessOverrides?.rating || deal.merchants?.rating || deal.businesses?.rating || 4.5;
  const dealLoc = businessOverrides?.location || deal.merchants?.location || deal.businesses?.location || deal.location || "";
  const avatar = businessOverrides?.avatarUrl || businessOverrides?.logo || deal.merchants?.avatarUrl || deal.merchants?.logo || deal.businesses?.avatarUrl || deal.businesses?.logo || null;
  // Use the merchant's Firestore doc ID captured from the merchants collection
  const merchantId = deal.merchants?.id || deal.merchant_id || deal.merchants_id || deal.business_id || null;

  return {
    id: deal.id,
    title: deal.title,
    image: deal.image_url || "/placeholder.svg",
    merchant: merchantName,
    location: dealLoc,
    rating: merchantRating,
    currentPrice: Number(deal.discounted_price),
    originalPrice: Number(deal.original_price),
    discount: deal.discount_percentage,
    category: deal.category,
    description: deal.description,
    businessId: merchantId,
    avatarUrl: avatar,
    subDeals: parseSubDeals(deal.subDeals || deal.sub_options),
    galleryUrls: parseGalleryUrls(deal.image_urls || deal.gallery_urls),
  };
}

export interface BusinessProfile {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  logo: string | null;
  avatarUrl: string | null;
  category: string | null;
  rating: number;
  review_count: number;
  opening_hours: string | null;
  phone: string | null;
  email: string | null;
}

export function useBusiness(id: string | undefined) {
  return useQuery({
    queryKey: ["business", id],
    enabled: !!id,
    queryFn: async () => {
      // Fetching from 'merchants' collection based on recent request, 
      // but keeping the hook name 'useBusiness' to minimize refactoring
      const docRef = doc(db, "merchants", id!);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;

      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || "Unknown Business",
        description: data.description,
        location: data.location,
        logo: data.logo,
        avatarUrl: data.avatarUrl || data.logo, // fallback to logo if avatarUrl is missing
        category: data.category,
        rating: data.rating || 0,
        review_count: data.review_count || 0,
        opening_hours: data.opening_hours,
        phone: data.phone,
        email: data.email,
      } as BusinessProfile;
    },
  });
}

// Build a name→{id, data} merchant map from all merchants in the collection.
// This is called once per query batch to avoid per-deal round trips.
async function buildMerchantNameMap(): Promise<Record<string, { id: string; data: any }>> {
  const snapshot = await getDocs(collection(db, "merchants"));
  const map: Record<string, { id: string; data: any }> = {};
  snapshot.forEach((docSnap) => {
    const d = docSnap.data();
    if (d.name) map[d.name.toLowerCase().trim()] = { id: docSnap.id, data: d };
  });
  return map;
}

// Resolve a merchant for a deal by ID ref first, falling back to name lookup.
async function resolveMerchant(
  dealData: any,
  nameMap: Record<string, { id: string; data: any }>
): Promise<{ merchantId: string | null; businessData: any }> {

  // Extract possible string IDs or reference IDs
  const getStrId = (val: any) => typeof val === "string" ? val : val?.id || val?.path?.split('/')?.pop();
  
  // 1. Try any explicit ID reference fields stored on the deal
  let refId = getStrId(dealData.merchantId) ||
              getStrId(dealData.merchants) || 
              getStrId(dealData.merchant_id) || 
              getStrId(dealData.merchants_id) || 
              getStrId(dealData.business_id) ||
              getStrId(dealData.businesses);

  // Sometimes 'merchant' holds the ID instead of the name
  if (!refId && typeof dealData.merchant === "string") {
    // If it looks like a Firestore ID (no spaces, length ~20) or explicitly "merchant1" style
    if (!dealData.merchant.includes(" ") && dealData.merchant.length >= 8) {
      refId = dealData.merchant;
    }
  }

  if (refId) {
    const merchantRef = doc(db, "merchants", refId);
    const merchantSnap = await getDoc(merchantRef);
    if (merchantSnap.exists()) {
      return { merchantId: merchantSnap.id, businessData: merchantSnap.data() };
    }
  }

  // 2. Fall back: match by the merchant name string on the deal
  const merchantName = dealData.merchant || dealData.merchants?.name || dealData.businesses?.name;
  if (merchantName && typeof merchantName === "string") {
    const entry = nameMap[merchantName.toLowerCase().trim()];
    if (entry) return { merchantId: entry.id, businessData: entry.data };
  }

  return { merchantId: null, businessData: null };
}

// Helper to fetch merchant details for a list of deals from the `merchants` collection
async function enrichDealsWithBusiness(querySnapshot: any) {
  // Pre-fetch all merchants once so name-based lookup is O(1) per deal
  const nameMap = await buildMerchantNameMap();

  const dealsPromises = querySnapshot.docs.map(async (docSnap: any) => {
    const dealData = docSnap.data();
    const { merchantId, businessData } = await resolveMerchant(dealData, nameMap);

    return {
      id: docSnap.id,
      ...dealData,
      merchants: businessData ? {
        id: merchantId,
        name: businessData.name,
        rating: businessData.rating,
        location: businessData.location,
        logo: businessData.logo,
        avatarUrl: businessData.avatarUrl || businessData.logo,
        category: businessData.category,
        description: businessData.description,
        email: businessData.email,
        opening_hours: businessData.opening_hours,
        phone: businessData.phone,
        review_count: businessData.review_count
      } : (dealData.merchants || dealData.businesses || null)
    };
  });

  const deals = await Promise.all(dealsPromises);
  return deals.map(d => mapDeal(d));
}

export function useDealsByBusiness(businessId: string | undefined) {
  return useQuery({
    queryKey: ["deals", "business", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      // Fetch all deals, enrich with merchants (which resolves IDs via name lookup),
      // then filter client-side to those belonging to this merchant.
      // This avoids composite index requirements and works even when deals don't
      // have an explicit business_id field.
      const q = query(collection(db, "deals"));
      const querySnapshot = await getDocs(q);
      const activeDocs = {
        docs: querySnapshot.docs.filter(d => {
          const status = d.data().status;
          return !status || status === "active";
        })
      };
      const allDeals = await enrichDealsWithBusiness(activeDocs);
      return allDeals.filter(d => d.businessId === businessId);
    },
  });
}

export function useDeals() {
  return useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      // Fetch all deals without composite index; filter + sort client-side
      const q = query(collection(db, "deals"));
      const querySnapshot = await getDocs(q);
      // Only include active deals (or deals with no status field set)
      const activeDocs = {
        docs: querySnapshot.docs.filter(d => {
          const status = d.data().status;
          return !status || status === "active";
        })
      };
      return enrichDealsWithBusiness(activeDocs);
    },
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: ["deal", id],
    enabled: !!id,
    queryFn: async () => {
      const docRef = doc(db, "deals", id!);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;

      const dealData = docSnap.data();

      // Build name map so single-deal fetches also get the name-based fallback
      const nameMap = await buildMerchantNameMap();
      const { merchantId, businessData } = await resolveMerchant(dealData, nameMap);

      return mapDeal({
        id: docSnap.id,
        ...dealData,
        merchants: businessData ? {
          id: merchantId,
          name: businessData.name,
          rating: businessData.rating,
          location: businessData.location,
          logo: businessData.logo,
          avatarUrl: businessData.avatarUrl || businessData.logo,
          category: businessData.category,
          description: businessData.description,
          email: businessData.email,
          opening_hours: businessData.opening_hours,
          phone: businessData.phone,
          review_count: businessData.review_count
        } : (dealData.merchants || dealData.businesses || null)
      });
    },
  });
}

export function useDealsByCategory(category: string) {
  return useQuery({
    queryKey: ["deals", "category", category],
    queryFn: async () => {
      // Avoid orderBy composite index; filter status client-side
      const q = query(
        collection(db, "deals"),
        where("category", "==", category)
      );
      const querySnapshot = await getDocs(q);
      const filtered = {
        docs: querySnapshot.docs.filter(d => {
          const status = d.data().status;
          return !status || status === "active";
        })
      };
      return enrichDealsWithBusiness(filtered);
    },
  });
}

export function useSearchDeals(searchQuery: string) {
  return useQuery({
    queryKey: ["deals", "search", searchQuery],
    enabled: searchQuery.trim().length > 0,
    queryFn: async () => {
      // Fetch all, filter client-side (avoids composite index requirement)
      const q = query(collection(db, "deals"));
      const querySnapshot = await getDocs(q);
      const activeDocs = {
        docs: querySnapshot.docs.filter(d => {
          const status = d.data().status;
          return !status || status === "active";
        })
      };
      const allDeals = await enrichDealsWithBusiness(activeDocs);

      const term = searchQuery.toLowerCase().trim();
      return allDeals.filter(deal =>
        (deal.title && deal.title.toLowerCase().includes(term)) ||
        (deal.category && deal.category.toLowerCase().includes(term)) ||
        (deal.location && deal.location.toLowerCase().includes(term))
      );
    },
  });
}

// Fetches ALL merchants from the `merchants` Firestore collection.
// Returns a map keyed by lowercase merchant name → merchant id.
// This lets DealCard look up a merchant ID even when the deal has no business_id field.
export function useMerchants() {
  return useQuery({
    queryKey: ["merchants-all"],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, "merchants"));
      const byName: Record<string, string> = {};
      const byId: Record<string, BusinessProfile> = {};

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const merchant: BusinessProfile = {
          id: docSnap.id,
          name: data.name || "",
          description: data.description ?? null,
          location: data.location ?? null,
          logo: data.logo ?? null,
          avatarUrl: data.avatarUrl || data.logo || null,
          category: data.category ?? null,
          rating: data.rating || 0,
          review_count: data.review_count || 0,
          opening_hours: data.opening_hours ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
        };

        byId[docSnap.id] = merchant;
        if (data.name) byName[data.name.toLowerCase()] = docSnap.id;
      });

      return { byId, byName };
    },
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });
}
