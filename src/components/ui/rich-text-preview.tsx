import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface RichTextPreviewProps {
  content: string;
  className?: string;
  placeholder?: string;
}

export default function RichTextPreview({ 
  content, 
  className,
  placeholder = "Sem descrição"
}: RichTextPreviewProps) {
  if (!content || content.trim() === '') {
    return (
      <span className={cn("text-lunar-textSecondary italic", className)}>
        {placeholder}
      </span>
    );
  }

  // Clean and format HTML content
  const formatContent = (html: string): string => {
    return html
      .replace(/<div>/g, '<p>')
      .replace(/<\/div>/g, '</p>')
      .replace(/<br>/g, '<br/>')
      // Ensure proper paragraph spacing
      .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
      .trim();
  };

  return (
    <div 
      className={cn(
        "prose prose-sm max-w-none text-lunar-textSecondary leading-relaxed",
        "prose-p:my-2 prose-strong:text-lunar-text prose-em:text-lunar-text",
        "prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
        className
      )}
      dangerouslySetInnerHTML={{ 
        __html: DOMPurify.sanitize(formatContent(content), {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'b', 'i', 'div', 'a'],
          ALLOWED_ATTR: ['href', 'target']
        })
      }}
    />
  );
}