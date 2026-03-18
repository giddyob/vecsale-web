import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Store, TrendingUp, Users, Shield, CheckCircle2 } from "lucide-react";
import { z } from "zod";

const merchantSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(100),
  businessAddress: z.string().trim().min(1, "Business address is required").max(200),
  contactName: z.string().trim().min(1, "Contact name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().min(1, "Phone number is required").max(20),
  website: z.string().trim().max(255).optional(),
  category: z.string().min(1, "Please choose a category"),
});

type MerchantForm = z.infer<typeof merchantSchema>;

const categoryOptions = [
  "Beauty & Wellness",
  "Food & Drink",
  "Things to Do",
  "Travel & Hotels",
  "Health & Fitness",
  "Auto Services",
  "Retail & Goods",
  "Gifts & Events",
  "Other",
];

const benefits = [
  {
    icon: Users,
    title: "Reach New Customers",
    description: "Connect with thousands of local deal-seekers ready to try your business.",
  },
  {
    icon: TrendingUp,
    title: "Grow Revenue",
    description: "Fill empty seats, drive foot traffic, and boost your sales — without upfront costs.",
  },
  {
    icon: Store,
    title: "Merchant Dashboard",
    description: "Manage your deals, track redemptions, and view analytics all in one place.",
  },
  {
    icon: Shield,
    title: "Trusted Platform",
    description: "Join a verified marketplace that customers trust for quality local experiences.",
  },
];

const MerchantSignup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof MerchantForm, string>>>({});
  const [form, setForm] = useState<MerchantForm>({
    businessName: "",
    businessAddress: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    category: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = merchantSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof MerchantForm, string>> = {};
      result.error.errors.forEach((err) => {
        const key = err.path[0] as keyof MerchantForm;
        fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Store in merchants collection with a "pending" status
      // Admin will review and approve
      const newId = crypto.randomUUID();
      await setDoc(doc(db, "merchants", newId), {
        id: newId,
        name: form.businessName,
        location: form.businessAddress,
        email: form.email,
        phone: form.phone,
        category: form.category,
        description: `PENDING APPROVAL | Contact: ${form.contactName} | Website: ${form.website || "N/A"}`,
        owner_id: user?.uid || null,
      });

      setSubmitted(true);
      toast({
        title: "Application Submitted!",
        description: "We'll review your application and get back to you within 2-3 business days.",
      });
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-lg py-20 text-center">
          <CheckCircle2 className="w-16 h-16 text-accent mx-auto mb-6" />
          <h1 className="text-3xl font-display font-extrabold text-foreground mb-4">
            Application Received!
          </h1>
          <p className="text-muted-foreground mb-8">
            Thank you for your interest in selling on VecSale. Our team will review your application and reach out within 2-3 business days.
          </p>
          <Button onClick={() => navigate("/")} className="bg-accent text-accent-foreground hover:opacity-90">
            Back to Home
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="bg-primary py-16 md:py-24">
        <div className="container text-center">
          <h1 className="text-3xl md:text-5xl font-display font-extrabold text-primary-foreground leading-tight mb-4">
            Grow Your Business with{" "}
            <span className="text-gradient-accent">VecSale</span>
          </h1>
          <p className="text-lg text-primary-foreground/70 max-w-2xl mx-auto">
            Reach nearby customers who are ready to buy. List your deals, attract new clients, and boost revenue — without upfront costs.
          </p>
        </div>
      </section>

      {/* Form + Benefits */}
      <section className="container py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Sign Up Form */}
          <div className="bg-card rounded-xl p-6 md:p-8 border border-border" style={{ boxShadow: "var(--shadow-card)" }}>
            <h2 className="text-2xl font-display font-bold text-foreground mb-6">
              Get Started — It's Free
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  name="businessName"
                  placeholder="Business Name"
                  value={form.businessName}
                  onChange={handleChange}
                  className="h-12"
                />
                {errors.businessName && <p className="text-sm text-destructive mt-1">{errors.businessName}</p>}
              </div>
              <div>
                <Input
                  name="businessAddress"
                  placeholder="Business Address"
                  value={form.businessAddress}
                  onChange={handleChange}
                  className="h-12"
                />
                {errors.businessAddress && <p className="text-sm text-destructive mt-1">{errors.businessAddress}</p>}
              </div>
              <div>
                <Input
                  name="contactName"
                  placeholder="First & Last Name"
                  value={form.contactName}
                  onChange={handleChange}
                  className="h-12"
                />
                {errors.contactName && <p className="text-sm text-destructive mt-1">{errors.contactName}</p>}
              </div>
              <div>
                <Input
                  name="email"
                  type="email"
                  placeholder="Email Address"
                  value={form.email}
                  onChange={handleChange}
                  className="h-12"
                />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <Input
                  name="phone"
                  type="tel"
                  placeholder="Phone Number"
                  value={form.phone}
                  onChange={handleChange}
                  className="h-12"
                />
                {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone}</p>}
              </div>
              <div>
                <Input
                  name="website"
                  placeholder="Website or Social Media Page (optional)"
                  value={form.website}
                  onChange={handleChange}
                  className="h-12"
                />
              </div>
              <div>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Choose a category</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {errors.category && <p className="text-sm text-destructive mt-1">{errors.category}</p>}
              </div>
              <p className="text-xs text-muted-foreground">
                By clicking below, I agree to the{" "}
                <a href="#" className="text-accent hover:underline">Terms of Use</a>{" "}
                and that I have read the{" "}
                <a href="#" className="text-accent hover:underline">Privacy Statement</a>.
              </p>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-semibold bg-accent text-accent-foreground hover:opacity-90"
              >
                {isSubmitting ? "Submitting..." : "Sign Up"}
              </Button>
            </form>
          </div>

          {/* Benefits */}
          <div className="space-y-8">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Why sell on VecSale?
            </h2>
            <p className="text-muted-foreground">
              From solo entrepreneurs to multi-location businesses. We help you grow — fast.
            </p>
            <div className="space-y-6">
              {benefits.map((b) => (
                <div key={b.title} className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                    <b.icon className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground mb-1">{b.title}</h3>
                    <p className="text-sm text-muted-foreground">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default MerchantSignup;
