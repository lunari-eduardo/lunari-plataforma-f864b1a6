import { Textarea } from '@/components/ui/textarea';

interface TextBlockProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextBlock({ value, onChange, placeholder }: TextBlockProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Digite o texto do parágrafo..."}
      className="min-h-[80px] resize-none font-body text-base leading-relaxed border-0 focus-visible:ring-0 p-0 shadow-none"
    />
  );
}
