import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2 } from 'lucide-react';

// Configure the worker to use the same version as installed via CDN to avoid Vite build issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface NativePdfViewerProps {
  url: string;
}

export function NativePdfViewer({ url }: NativePdfViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize observer to ensure the PDF fits the container perfectly
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          // Adjust width, minus a small padding if desired
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
      setContainerWidth(containerRef.current.clientWidth);
    }
    
    return () => observer.disconnect();
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  return (
    <div 
      className="w-full h-full min-h-screen bg-[#F3F4F6] flex flex-col items-center pt-8 pb-32"
      ref={containerRef}
    >
      <div className="w-full max-w-4xl px-4 md:px-8 mx-auto flex flex-col gap-6 items-center">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Carregando proposta...</p>
            </div>
          }
          error={
            <div className="bg-destructive/10 text-destructive p-6 rounded-xl border border-destructive/20 text-center w-full">
              <p className="font-semibold mb-2">Erro ao carregar o PDF</p>
              <p className="text-sm opacity-90">Não foi possível carregar o arquivo. O arquivo pode estar corrompido ou o link expirou.</p>
              <a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-block bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm">
                Tentar baixar o arquivo
              </a>
            </div>
          }
        >
          {numPages && Array.from(new Array(numPages), (el, index) => (
            <div 
              key={`page_${index + 1}`} 
              className="mb-6 shadow-xl rounded-md overflow-hidden bg-white mx-auto transition-transform hover:shadow-2xl"
              style={{ width: 'fit-content' }}
            >
              <Page 
                pageNumber={index + 1} 
                width={containerWidth ? Math.min(containerWidth - 32, 1024) : undefined}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={
                  <div className="flex justify-center items-center h-[800px] bg-white w-full max-w-3xl">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/30" />
                  </div>
                }
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}
