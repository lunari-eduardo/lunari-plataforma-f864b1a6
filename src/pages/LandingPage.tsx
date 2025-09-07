import { Camera, Users, DollarSign, BarChart3 } from "lucide-react";
import LandingHero from "@/components/landing/LandingHero";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingScrollCards from "@/components/landing/LandingScrollCards";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingFAQ from "@/components/landing/LandingFAQ";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingGains from "@/components/landing/LandingGains";
import LandingOffer from "@/components/landing/LandingOffer";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-landing-bg text-landing-text">
      <LandingHero />
      <LandingGains />
      <LandingFeatures />
      <LandingScrollCards />
      <LandingOffer />
      <LandingHowItWorks />
      <LandingPricing />
      <LandingFAQ />
      <LandingFooter />
    </div>
  );
}