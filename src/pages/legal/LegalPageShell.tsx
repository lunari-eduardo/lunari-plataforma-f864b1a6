import { displayFont, uiFont } from "@/components/landing/primitives";
import { PageHeader } from "@/components/layout/PageHeader";

interface LegalPageProps {
  title: string;
  updatedAt: string;
  content: React.ReactNode;
}

export function LegalPageShell({ title, updatedAt, content }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-[#FAFAF7] py-20">
      <div className="mx-auto max-w-[800px] px-6 md:px-8">
        <div className="mb-12">
          <h1 
            className="text-4xl md:text-5xl font-medium tracking-tight text-[#0A0A0A] mb-4"
            style={displayFont}
          >
            {title}
          </h1>
          <p className="text-sm text-[#0A0A0A]/40 uppercase tracking-widest" style={uiFont}>
            Última atualização: {updatedAt}
          </p>
        </div>
        
        <div 
          className="prose prose-slate max-w-none 
            prose-headings:font-medium prose-headings:text-[#0A0A0A] prose-headings:tracking-tight
            prose-p:text-[#0A0A0A]/70 prose-p:leading-relaxed prose-p:text-[16px]
            prose-li:text-[#0A0A0A]/70 prose-li:text-[16px]
            prose-strong:text-[#0A0A0A] prose-strong:font-semibold
            space-y-8"
          style={uiFont}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
