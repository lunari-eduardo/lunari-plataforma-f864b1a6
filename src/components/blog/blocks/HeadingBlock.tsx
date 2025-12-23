import { Input } from '@/components/ui/input';

interface HeadingBlockProps {
  value: string;
  onChange: (value: string) => void;
  level: 'h1' | 'h2' | 'h3';
  placeholder?: string;
}

export function HeadingBlock({ value, onChange, level, placeholder }: HeadingBlockProps) {
  const styles = {
    h1: 'text-3xl font-bold font-serif',
    h2: 'text-2xl font-semibold font-serif',
    h3: 'text-xl font-medium font-serif',
  };

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || `Digite o ${level === 'h1' ? 'título principal' : level === 'h2' ? 'subtítulo' : 'título'}...`}
      className={`${styles[level]} border-0 focus-visible:ring-0 p-0 shadow-none h-auto`}
    />
  );
}
