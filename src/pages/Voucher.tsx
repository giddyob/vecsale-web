import { useParams, Link } from "react-router-dom";
import { useRef, useState } from "react";
import { ArrowLeft, CheckCircle, Clock, Share2, MapPin, Download, Package } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import vecsaleLogo from "@/assets/vecsale-logo.png";

const statusConfig = {
  unused: { label: "Active", icon: Package, color: "#1B5E20", bg: "#E8F5E9" },
  used: { label: "Used", icon: CheckCircle, color: "#757575", bg: "#F5F5F5" },
  expired: { label: "Expired", icon: Clock, color: "#B71C1C", bg: "#FFEBEE" },
};

const Voucher = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const voucherRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const { data: coupon, isLoading } = useQuery({
    queryKey: ["voucher", id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const docRef = doc(db, "coupons", id!);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;

      const data = { id: docSnap.id, ...docSnap.data() } as any;

      // Prefer deal_snapshot stored directly on the coupon (new flow)
      if (data.deal_snapshot && data.deal_snapshot.title) {
        data.deals = {
          title: data.deal_snapshot.title,
          image_url: data.deal_snapshot.image_url,
          discounted_price: data.deal_snapshot.discounted_price,
          original_price: data.deal_snapshot.original_price,
          location: data.deal_snapshot.location,
          expiry_date: data.deal_snapshot.expiry_date,
          description: data.deal_snapshot.description,
          businesses: {
            name: data.deal_snapshot.business_name || data.business_name || "Local Merchant",
            logo: data.deal_snapshot.business_logo || null,
            location: data.deal_snapshot.business_location || data.deal_snapshot.location || null,
            phone: data.deal_snapshot.business_phone || null,
          },
        };
      } else if (data.deal_id) {
        // Fallback for older coupons without a snapshot
        const dealRef = doc(db, "deals", data.deal_id);
        const dealSnap = await getDoc(dealRef);
        if (dealSnap.exists()) {
          const dealData = dealSnap.data();
          data.deals = {
            title: dealData.title,
            image_url: dealData.image_url,
            discounted_price: dealData.discounted_price,
            original_price: dealData.original_price,
            location: dealData.location,
            expiry_date: dealData.expiry_date,
            description: dealData.description,
          };

          // Robust merchant resolution (mirrors useDeals.ts logic)
          const getStrId = (val: any) => typeof val === "string" ? val : val?.id || val?.path?.split("/")?.pop();
          let refId = getStrId(dealData.merchantId) ||
                      getStrId(dealData.merchants) ||
                      getStrId(dealData.merchant_id) ||
                      getStrId(dealData.merchants_id) ||
                      getStrId(dealData.business_id) ||
                      getStrId(dealData.businesses);

          // merchant field might hold an ID instead of a name
          if (!refId && typeof dealData.merchant === "string" && !dealData.merchant.includes(" ") && dealData.merchant.length >= 8) {
            refId = dealData.merchant;
          }

          if (refId) {
            const merchantRef = doc(db, "merchants", refId);
            const merchantSnap = await getDoc(merchantRef);
            if (merchantSnap.exists()) {
              data.deals.businesses = merchantSnap.data();
            }
          }

          // If still no businesses resolved, try name-based lookup
          if (!data.deals.businesses) {
            const merchantName = dealData.merchant || dealData.merchants?.name || dealData.businesses?.name;
            if (merchantName && typeof merchantName === "string") {
              const allMerchants = await getDocs(collection(db, "merchants"));
              for (const mDoc of allMerchants.docs) {
                const mData = mDoc.data();
                if (mData.name && mData.name.toLowerCase().trim() === merchantName.toLowerCase().trim()) {
                  data.deals.businesses = mData;
                  break;
                }
              }
            }
            // If still nothing, at least set the name from the deal
            if (!data.deals.businesses && dealData.merchant) {
              data.deals.businesses = { name: dealData.merchant };
            }
          }
        }
      }
      return data;
    },
  });

  const generatePDF = async (): Promise<Blob> => {
    const el = voucherRef.current;
    if (!el) throw new Error("Voucher element not found");

    // Hide elements that shouldn't appear in the PDF
    const heroImg = el.querySelector("[data-voucher-image]") as HTMLElement | null;
    const actionBtns = el.querySelector("[data-voucher-actions]") as HTMLElement | null;
    if (heroImg) heroImg.style.display = "none";
    if (actionBtns) actionBtns.style.display = "none";

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    // Restore hidden elements
    if (heroImg) heroImg.style.display = "";
    if (actionBtns) actionBtns.style.display = "";

    const imgData = canvas.toDataURL("image/png");

    // Use dynamic page height so nothing gets clipped
    const pdfW = 148; // A5 width in mm
    const pdfH = (canvas.height * pdfW) / canvas.width;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pdfW, pdfH] });
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    return pdf.output("blob");
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const blob = await generatePDF();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vecsale-voucher-${coupon?.code || "download"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Voucher downloaded!");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    setGenerating(true);
    try {
      const blob = await generatePDF();
      const file = new File([blob], `vecsale-voucher-${coupon?.code || "share"}.pdf`, {
        type: "application/pdf",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `Voucher - ${coupon?.deals?.title}`, files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("PDF downloaded (sharing not supported on this device)");
      }
    } catch {
      toast.error("Failed to share voucher");
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center text-muted-foreground">Loading...</div>
        <Footer />
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-4">Voucher not found</h1>
          <Link to="/my-stuff" className="text-accent hover:underline">
            Back to My Stuff
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const deal = coupon.deals as any;
  const merchant = deal?.merchants || deal?.businesses;
  const st = (coupon.status || "unused") as keyof typeof statusConfig;
  const { label, icon: Icon, color: statusColor, bg: statusBg } = statusConfig[st] || statusConfig.unused;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 max-w-lg">
        <Link
          to="/my-stuff"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Stuff
        </Link>

        {/* ── Voucher Card (this entire div is captured for PDF) ── */}
        <div
          ref={voucherRef}
          className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.12)", border: "1px solid #e5e7eb" }}
        >
          {/* ── Header band with Vecsale branding ── */}
          <div
            style={{
              background: "#ffffff",
              padding: "20px 24px 16px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <img
                src={vecsaleLogo}
                alt="Vecsale"
                style={{ height: 36, objectFit: "contain" }}
              />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  borderRadius: 999,
                  backgroundColor: statusBg,
                  color: statusColor,
                }}
              >
                <Icon size={11} />
                {label.toUpperCase()}
              </span>
            </div>

            <div style={{ marginTop: 14 }}>
              <p style={{ color: "#9E9E9E", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 2 }}>
                DEAL
              </p>
              <h2 style={{ color: "#212121", fontSize: 20, fontWeight: 800, lineHeight: 1.25, margin: 0 }}>
                {deal?.title || "Deal"}
              </h2>
            </div>
          </div>

          {/* ── Deal hero image ── */}
          {deal?.image_url && (
            <img
              data-voucher-image
              src={deal.image_url}
              alt={deal.title}
              style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
            />
          )}

          <div style={{ padding: "24px" }}>
            {/* ── Price + Expiry row ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
                padding: "12px 16px",
                backgroundColor: "#F1F8E9",
                borderRadius: 12,
                border: "1px solid #DCEDC8",
              }}
            >
              <div>
                <p style={{ fontSize: 10, color: "#558B2F", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 2 }}>
                  YOU PAY
                </p>
                <p style={{ fontSize: 24, fontWeight: 800, color: "#1B5E20", margin: 0 }}>
                  GH₵{deal?.discounted_price}
                </p>
                {deal?.original_price && (
                  <p style={{ fontSize: 12, color: "#9E9E9E", textDecoration: "line-through", margin: 0 }}>
                    GH₵{deal.original_price}
                  </p>
                )}
              </div>
              {deal?.expiry_date && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 10, color: "#9E9E9E", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 2 }}>
                    EXPIRES
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#424242", margin: 0 }}>
                    {new Date(deal.expiry_date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* ── Dashed tear-line ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#f3f4f6", flexShrink: 0, marginLeft: -32 }} />
              <div style={{ flex: 1, borderTop: "2px dashed #e5e7eb" }} />
              <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#f3f4f6", flexShrink: 0, marginRight: -32 }} />
            </div>

            {/* ── QR Code + Code ── */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <QRCodeSVG value={coupon.code} size={160} level="H" includeMargin={false} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 10, color: "#9E9E9E", fontWeight: 600, letterSpacing: "0.12em", marginBottom: 4 }}>
                  VOUCHER CODE
                </p>
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: "0.15em",
                    color: "#1B5E20",
                    background: "#F1F8E9",
                    padding: "6px 18px",
                    borderRadius: 8,
                    border: "1px dashed #A5D6A7",
                    margin: 0,
                  }}
                >
                  {coupon.code}
                </p>
              </div>
            </div>

            {/* ── Dashed tear-line ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#f3f4f6", flexShrink: 0, marginLeft: -32 }} />
              <div style={{ flex: 1, borderTop: "2px dashed #e5e7eb" }} />
              <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#f3f4f6", flexShrink: 0, marginRight: -32 }} />
            </div>

            {/* ── Merchant / Business Block ── */}
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "#FAFAFA",
                borderRadius: 12,
                border: "1px solid #F0F0F0",
                marginBottom: 20,
              }}
            >
              <p style={{ fontSize: 10, color: "#9E9E9E", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 2 }}>
                REDEEMABLE AT
              </p>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#212121", margin: 0 }}>
                {merchant?.name || "Local Merchant"}
              </p>
              {(merchant?.location || deal?.location) && (
                <p style={{ fontSize: 12, color: "#757575", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <MapPin size={11} /> {merchant?.location || deal?.location}
                </p>
              )}
              {merchant?.phone && (
                <p style={{ fontSize: 12, color: "#757575", marginTop: 1 }}>📞 {merchant.phone}</p>
              )}
            </div>

            {/* ── Footer note ── */}
            <p
              style={{
                fontSize: 10,
                color: "#BDBDBD",
                textAlign: "center",
                lineHeight: 1.5,
                marginBottom: 0,
              }}
            >
              Present this voucher (QR code or code) to the merchant to redeem your deal.
              <br />
              Powered by <strong style={{ color: "#2E7D32" }}>Vecsale</strong>
            </p>
          </div>

          {/* ── Action Buttons ── */}
          <div
            data-voucher-actions
            style={{
              padding: "0 24px 24px",
              display: "flex",
              gap: 12,
            }}
          >
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1 gap-2"
              disabled={generating}
            >
              <Download className="w-4 h-4" />
              {generating ? "Generating..." : "Download PDF"}
            </Button>
            <Button
              onClick={handleShare}
              variant="default"
              className="flex-1 gap-2"
              disabled={generating}
            >
              <Share2 className="w-4 h-4" /> Share
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Voucher;
