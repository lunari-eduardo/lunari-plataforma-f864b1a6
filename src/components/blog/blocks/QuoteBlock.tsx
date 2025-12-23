import { Textarea } from '@/components/ui/textarea';

interface QuoteBlockProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function QuoteBlock({ value, onChange, placeholder }: QuoteBlockProps) {
  return (
    <div className="border-l-4 border-primary pl-4">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Digite a citação..."}
        className="min-h-[60px] resize-none font-serif text-lg italic leading-relaxed border-0 focus-visible:ring-0 p-0 shadow-none bg-transparent"
      />
    </div>
  );
}
