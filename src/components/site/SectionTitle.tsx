import { ReactNode } from "react";
import { SiteH2, SiteEyebrow } from "./typography";

type Tone = "light" | "dark";

export function SectionTitle({
  children,
  emphasis,
  tone = "light",
  className = "",
}: {
  children: ReactNode;
  emphasis?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <SiteH2 tone={tone} className={className}>
      {children}
      {emphasis && (
        <>
          {" "}
          <span className="text-site-gold italic font-normal" style={{ fontFamily: '"Instrument Serif", serif' }}>
            {emphasis}
          </span>
        </>
      )}
    </SiteH2>
  );
}

export function SectionKicker({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <SiteEyebrow className="mb-2">
      {children}
    </SiteEyebrow>
  );
}