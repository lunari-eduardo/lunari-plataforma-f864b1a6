import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface HtmlLiveEditorProps {
  htmlContent: string;
  onChange: (html: string) => void;
  viewMode: 'desktop' | 'mobile';
}

export function HtmlLiveEditor({ htmlContent, onChange, viewMode }: HtmlLiveEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the initial HTML content into the iframe
  useEffect(() => {
    if (!iframeRef.current) return;
    const iframe = iframeRef.current;
    
    // Configura o Iframe com o HTML e ativa o designMode
    const handleLoad = () => {
      setIsLoading(false);
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          doc.designMode = 'on'; // Enable WYSIWYG editing

          // Intercept clicks to prevent links from navigating
          doc.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName.toLowerCase() === 'a') {
              e.preventDefault();
            }
          });

          // Watch for changes and call onChange
          const observer = new MutationObserver(() => {
            const currentHtml = doc.documentElement.outerHTML;
            onChange(currentHtml);
          });
          
          observer.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true });
        }
      } catch (err) {
        console.error('Failed to initialize HtmlLiveEditor:', err);
      }
    };

    // Prepare iframe
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      
      // If it loaded immediately
      if (doc.readyState === 'complete') {
        handleLoad();
      } else {
        iframe.addEventListener('load', handleLoad);
      }
    }

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, []); // Run only once to load the initial content, then rely on mutation observer to update the parent

  return (
    <div className={cn(
      "w-full h-full relative flex justify-center bg-muted/30 transition-all duration-300",
      viewMode === 'mobile' ? 'py-8' : ''
    )}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <div 
        className={cn(
          "bg-white shadow-sm overflow-hidden h-full flex flex-col transition-all duration-300 relative",
          viewMode === 'mobile' ? 'w-[400px] h-[800px] rounded-[2rem] shadow-2xl border-8 border-border' : 'w-full'
        )}
      >
        <div className="bg-amber-100 text-amber-800 text-xs text-center py-1 font-medium border-b border-amber-200">
          Modo Edição Livre: Clique nos textos para alterar
        </div>
        <iframe
          ref={iframeRef}
          className="w-full flex-1 border-none bg-white"
          title="Live HTML Editor"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}
