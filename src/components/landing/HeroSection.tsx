import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon } from "lucide-react";
import { Mockup, MockupFrame } from "@/components/ui/mockup";
import { Glow } from "@/components/ui/glow";
import { cn } from "@/lib/utils";

interface HeroAction {
  text: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
}

interface HeroProps {
  badge?: {
    text: string;
    action?: {
      text: string;
      href: string;
    };
  };
  title: string;
  description: string;
  actions: HeroAction[];
  image?: {
    src: string;
    alt: string;
  };
}

export function HeroSection({
  badge,
  title,
  description,
  actions,
  image,
}: HeroProps) {
  return (
    <section
      className={cn(
        "bg-landing-bg text-landing-text",
        "py-8 sm:py-16 md:py-20 lg:py-24 px-4",
        "overflow-hidden"
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8 pt-8 sm:gap-12 sm:pt-12 md:gap-16 md:pt-16">
        <div className="flex flex-col items-center gap-4 text-center sm:gap-6 md:gap-8">
          {/* Logo */}
          <div className="animate-fade-up opacity-0">
            <img 
              src="/lovable-uploads/ad17340d-9f1f-41dc-ad2b-31099ceefd35.png" 
              alt="Lunari Logo" 
              className="h-16 w-auto sm:h-20 md:h-24 hover-lift"
            />
          </div>

          {/* Badge */}
          {badge && (
            <Badge 
              variant="outline" 
              className="animate-fade-up opacity-0 delay-200 gap-2 text-sm font-medium px-4 py-2 hover-lift"
            >
              <span className="text-landing-text/80">{badge.text}</span>
              {badge.action && (
                <a href={badge.action.href} className="flex items-center gap-1 text-landing-accent">
                  {badge.action.text}
                  <ArrowRightIcon className="h-3 w-3" />
                </a>
              )}
            </Badge>
          )}

          {/* Title */}
          <h1 className={cn(
            "relative z-10 animate-fade-up opacity-0 delay-400",
            "font-display font-bold leading-tight",
            "text-3xl sm:text-4xl md:text-5xl lg:text-6xl",
            "animate-title-gradient bg-clip-text text-transparent",
            "px-4 sm:px-6 md:px-8"
          )}>
            {title}
          </h1>

          {/* Description */}
          <p className={cn(
            "relative z-10 animate-fade-up opacity-0 delay-600",
            "max-w-2xl font-medium text-landing-text/80",
            "text-base sm:text-lg md:text-xl",
            "px-4 sm:px-6"
          )}>
            {description}
          </p>

          {/* Actions */}
          <div className="relative z-10 animate-fade-up opacity-0 delay-800 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none">
            {actions.map((action, index) => (
              <Button 
                key={index} 
                variant={action.variant || "default"} 
                size="lg" 
                onClick={action.onClick}
                asChild={!!action.href}
                className="hover-lift font-medium text-sm sm:text-base px-6 py-3"
              >
                {action.href ? (
                  <a href={action.href} className="flex items-center justify-center gap-2">
                    {action.icon}
                    {action.text}
                  </a>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {action.icon}
                    {action.text}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Image with Glow */}
          {image && (
            <div className="relative pt-8 sm:pt-12 w-full max-w-5xl">
              <MockupFrame
                className="animate-fade-up opacity-0 delay-1000 hover-lift"
                size="small"
              >
                <Mockup type="responsive">
                  <img
                    src="/lovable-uploads/d00afad7-bf0d-405b-b02e-1b48424f9ccd.png"
                    alt="Interface do Lunari - Dashboard completo para fotógrafos"
                    className="w-full h-auto rounded-lg"
                  />
                </Mockup>
              </MockupFrame>
              <Glow
                variant="top"
                className="animate-appear-zoom opacity-0 delay-1000"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}