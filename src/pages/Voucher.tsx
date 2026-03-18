import { useParams, Link } from "react-router-dom";
import { useRef, useState } from "react";
import { ArrowLeft, Package, CheckCircle, Clock, Share2, MapPin, Store, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const statusConfig = {
  UNUSED: { label: "Active", icon: Package, variant: "default" as const },
  USED: { label: "Used", icon: CheckCircle, variant: "secondary" as const },
  EXPIRED: { label: "Expired", icon: Clock, variant: "outline" as const },
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
      const { data, error } = await supabase
        .from("coupons")
        .select("*, deals:deal_id(title, image_url, discounted_price, original_price, location, expiry_date, description, businesses(name, location, phone, email, logo))")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const generatePDF = async (): Promise<Blob> => {
    const el = voucherRef.current;
    if (!el) throw new Error("Voucher element not found");
    // Hide the deal image during PDF capture
    const img = el.querySelector("[data-voucher-image]") as HTMLElement | null;
    if (img) img.style.display = "none";
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    if (img) img.style.display = "";
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
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
      a.download = `voucher-${coupon?.code || "download"}.pdf`;
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
      const file = new File([blob], `voucher-${coupon?.code || "share"}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `Voucher - ${coupon?.deals?.title}`, files: [file] });
      } else {
        // Fallback to download
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
          <Link to="/my-stuff" className="text-accent hover:underline">Back to My Stuff</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const deal = coupon.deals as any;
  const merchant = deal?.merchants || deal?.businesses;
  const st = (coupon.status || "UNUSED") as keyof typeof statusConfig;
  const { label, icon: Icon, variant } = statusConfig[st] || statusConfig.UNUSED;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 max-w-lg">
        <Link to="/my-stuff" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to My Stuff
        </Link>

        {/* Voucher Card */}
        <div ref={voucherRef} className="bg-card rounded-2xl overflow-hidden border border-border" style={{ boxShadow: "var(--shadow-card)" }}>
          {/* Header image */}
          {deal?.image_url && (
            <img data-voucher-image src={deal.image_url} alt={deal.title} className="w-full h-40 object-cover" />
          )}

          <div className="p-6 space-y-6">
            {/* Status & Title */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Badge variant={variant} className="gap-1">
                  <Icon className="w-3 h-3" /> {label}
                </Badge>
                {deal?.expiry_date && (
                  <span className="text-xs text-muted-foreground">
                    Expires: {new Date(deal.expiry_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-display font-bold text-foreground">{deal?.title || "Deal"}</h1>
              {deal?.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{deal.description}</p>
              )}
            </div>

            {/* Dashed separator */}
            <div className="border-t-2 border-dashed border-border" />

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={coupon.code}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Voucher Code</p>
                <p className="text-lg font-mono font-bold text-foreground tracking-widest mt-0.5">{coupon.code}</p>
              </div>
            </div>

            {/* Dashed separator */}
            <div className="border-t-2 border-dashed border-border" />

            {/* Merchant Details */}
            {merchant && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Merchant</p>
                <div className="flex items-center gap-3">
                  {merchant.logo ? (
                    <img src={merchant.logo} alt={merchant.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <Store className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{merchant.name}</p>
                    {(merchant.location || deal?.location) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {merchant.location || deal.location}
                      </p>
                    )}
                  </div>
                </div>
                {merchant.phone && (
                  <p className="text-xs text-muted-foreground">📞 {merchant.phone}</p>
                )}
                {merchant.email && (
                  <p className="text-xs text-muted-foreground">✉️ {merchant.email}</p>
                )}
              </div>
            )}

            {/* Share Button */}
            <div className="flex gap-3">
              <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2" disabled={generating}>
                <Download className="w-4 h-4" /> {generating ? "Generating..." : "Download PDF"}
              </Button>
              <Button onClick={handleShare} variant="default" className="flex-1 gap-2" disabled={generating}>
                <Share2 className="w-4 h-4" /> Share
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Voucher;
