import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { List, ListOrdered } from 'lucide-react';

interface ListBlockProps {
  value: string;
  onChange: (value: string) => void;
  listType: 'ul' | 'ol';
  onListTypeChange: (type: 'ul' | 'ol') => void;
  placeholder?: string;
}

export function ListBlock({ value, onChange, listType, onListTypeChange, placeholder }: ListBlockProps) {
  // Parse HTML list to plain text for editing
  const htmlToText = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<${listType}>${html}</${listType}>`, 'text/html');
    const items = doc.querySelectorAll('li');
    return Array.from(items).map(li => li.textContent).join('\n') || html.replace(/<li>/gi, '').replace(/<\/li>/gi, '\n').trim();
  };

  // Convert plain text back to HTML list items
  const textToHtml = (text: string): string => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => `<li>${line.trim()}</li>`).join('');
  };

  const handleChange = (text: string) => {
    onChange(textToHtml(text));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <Button
          variant={listType === 'ul' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onListTypeChange('ul')}
          className="gap-2"
        >
          <List className="h-4 w-4" />
          Marcadores
        </Button>
        <Button
          variant={listType === 'ol' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onListTypeChange('ol')}
          className="gap-2"
        >
          <ListOrdered className="h-4 w-4" />
          Numerada
        </Button>
      </div>
      <Textarea
        value={htmlToText(value)}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder || "Digite cada item em uma linha..."}
        className="min-h-[100px] resize-none font-body text-base leading-relaxed border-0 focus-visible:ring-0 p-0 shadow-none"
      />
      <p className="text-xs text-muted-foreground">
        Cada linha será um item da lista
      </p>
    </div>
  );
}
