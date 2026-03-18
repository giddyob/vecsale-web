import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { mapDeal } from "./useDeals";

export function useFavorites() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["favorites", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      const q = query(collection(db, "favorites"), where("user_id", "==", user!.uid));
      const querySnapshot = await getDocs(q);
      const favoriteIds: string[] = [];
      querySnapshot.forEach((doc) => {
        favoriteIds.push(doc.data().deal_id);
      });
      return favoriteIds;
    },
  });
}

export function useFavoriteDeals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["favorite-deals", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      // 1. Fetch favorite deal IDs
      const q = query(collection(db, "favorites"), where("user_id", "==", user!.uid));
      const querySnapshot = await getDocs(q);
      const favoriteIds: string[] = [];
      querySnapshot.forEach((doc) => {
        favoriteIds.push(doc.data().deal_id);
      });

      if (favoriteIds.length === 0) return [];

      // 2. Fetch the actual deals by those IDs
      const dealsAndBusinesses = await Promise.all(
        favoriteIds.map(async (dealId) => {
          const dealDocRef = doc(db, "deals", dealId);
          const dealDocSnap = await getDoc(dealDocRef);
          
          if (!dealDocSnap.exists()) return null;
          
          const dealData = dealDocSnap.data();
          let merchantId: string | null = null;
          let businessData: any = null;

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
              merchantId = merchantSnap.id;
              businessData = merchantSnap.data();
            }
          }

          // Construct the combined object expected by mapDeal
          return {
            id: dealId,
            ...dealData,
            merchants: businessData ? {
              id: merchantId,
              name: businessData.name,
              rating: businessData.rating,
              location: businessData.location
            } : (dealData.merchants || dealData.businesses || null)
          };
        })
      );
      
      const validDeals = dealsAndBusinesses.filter(Boolean);
      
      // Need to emulate the format expected by useFavoriteDeals which was:
      // data: [{ deal_id: "xyz", deals: DealWithAssocData }] 
      return validDeals.map(d => ({
         deal_id: d.id,
         deals: d
      }));
    },
  });
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, isFavorited }: { dealId: string; isFavorited: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      
      // We'll use a composite ID for the document to easily toggle it
      const docId = `${user.uid}_${dealId}`;
      const docRef = doc(db, "favorites", docId);
      
      if (isFavorited) {
         await deleteDoc(docRef);
      } else {
         await setDoc(docRef, {
            user_id: user.uid,
            deal_id: dealId,
            created_at: new Date().toISOString()
         });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-deals"] });
    },
  });
}
