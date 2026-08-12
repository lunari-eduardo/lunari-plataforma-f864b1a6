import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { useActiveModule, AppModule } from '@/contexts/ModuleContext';
import { cn } from '@/lib/utils';

interface ProductSwitcherProps {
  expanded?: boolean;
}

export function ProductSwitcher({ expanded = true }: ProductSwitcherProps) {
  const { activeModule, setActiveModule } = useActiveModule();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Fecha o submenu automaticamente se a sidebar retrair
  React.useEffect(() => {
    if (!expanded) setIsOpen(false);
  }, [expanded]);

  const handleSelectModule = (module: AppModule) => {
    setActiveModule(module);
    setIsOpen(false);
    if (module === 'gallery') {
      navigate('/app/gallery');
    } else {
      navigate('/app');
    }
  };

  return (
    <div className="w-full px-2 mb-4 flex flex-col">
      <button
        onClick={() => expanded && setIsOpen(!isOpen)}
        className={cn(
          "flex items-center w-full rounded-lg transition-colors duration-200 outline-none hover:bg-white/5",
          expanded ? "justify-between px-3 h-10" : "justify-center h-10"
        )}
        title="Mudar Módulo"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <span className={cn(
            "flex-shrink-0 flex items-center justify-center transition-colors duration-200",
            expanded ? "text-[hsl(var(--sidebar-icon))]" : "text-[hsl(var(--sidebar-icon-collapsed))] group-hover:text-[hsl(var(--sidebar-icon-collapsed-hover))]"
          )}>
            {activeModule === 'studio' ? <LayoutGrid size={16} /> : <ImageIcon size={16} />}
          </span>
          <span className={cn(
            "text-sm font-semibold whitespace-nowrap transition-opacity duration-150 ease-out text-[hsl(var(--sidebar-fg))]",
            expanded ? "opacity-100 delay-[60ms]" : "opacity-0 hidden"
          )}>
            {activeModule === 'studio' ? 'Lunari Studio' : 'Lunari Gallery'}
          </span>
        </div>
        
        <ChevronDown 
          size={14} 
          className={cn(
            "text-[hsl(var(--sidebar-fg))]/50 shrink-0 transition-all duration-200", 
            expanded ? "opacity-100 delay-[60ms]" : "opacity-0 hidden",
            isOpen && "transform rotate-180"
          )} 
        />
      </button>

      {/* Accordion Content */}
      {expanded && isOpen && (
        <div className="flex flex-col mt-1 ml-4 border-l border-[hsl(var(--sidebar-border))] pl-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <button
            className={cn(
              "flex flex-col items-start w-full py-1.5 px-2 rounded-md transition-all duration-200 text-left hover:bg-white/5",
              activeModule === 'studio' ? "bg-[hsl(var(--sidebar-accent))]" : ""
            )}
            onClick={() => handleSelectModule('studio')}
          >
            <div className="flex items-center justify-between w-full">
              <div className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                activeModule === 'studio' ? "text-[hsl(var(--accent-gold))] font-medium" : "text-[hsl(var(--sidebar-fg))] opacity-80"
              )}>
                <LayoutGrid size={12} />
                Lunari Studio
              </div>
              {activeModule === 'studio' && <Check size={12} className="text-[hsl(var(--accent-gold))]" />}
            </div>
          </button>
          
          <button
            className={cn(
              "flex flex-col items-start w-full py-1.5 px-2 rounded-md transition-all duration-200 text-left hover:bg-white/5",
              activeModule === 'gallery' ? "bg-[hsl(var(--sidebar-accent))]" : ""
            )}
            onClick={() => handleSelectModule('gallery')}
          >
            <div className="flex items-center justify-between w-full">
              <div className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                activeModule === 'gallery' ? "text-[hsl(var(--accent-gold))] font-medium" : "text-[hsl(var(--sidebar-fg))] opacity-80"
              )}>
                <ImageIcon size={12} />
                Lunari Gallery
              </div>
              {activeModule === 'gallery' && <Check size={12} className="text-[hsl(var(--accent-gold))]" />}
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
