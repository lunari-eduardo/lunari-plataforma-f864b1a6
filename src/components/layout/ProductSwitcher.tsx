import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { ChevronDown, Check, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { useActiveModule, AppModule } from '@/contexts/ModuleContext';
import { cn } from '@/lib/utils';

interface ProductSwitcherProps {
  expanded?: boolean;
}

export function ProductSwitcher({ expanded = true }: ProductSwitcherProps) {
  const { activeModule, setActiveModule } = useActiveModule();
  const navigate = useNavigate();

  const handleSelectModule = (module: AppModule) => {
    setActiveModule(module);
    if (module === 'gallery') {
      navigate('/app/gallery');
    } else {
      navigate('/app');
    }
  };

  return (
    <div className="w-full px-2 mb-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center w-full rounded-md transition-colors duration-200 outline-none text-[hsl(var(--sidebar-fg))] hover:bg-white/10",
              expanded ? "justify-between px-3 h-10" : "justify-center h-10"
            )}
            title="Mudar Módulo"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={cn(
                "flex-shrink-0 flex items-center justify-center text-[hsl(var(--sidebar-icon))]",
                !expanded && "text-[hsl(var(--sidebar-icon-collapsed))] group-hover:text-[hsl(var(--sidebar-icon-collapsed-hover))]"
              )}>
                {activeModule === 'studio' ? <LayoutGrid size={16} /> : <ImageIcon size={16} />}
              </span>
              <span className={cn(
                "text-sm font-medium whitespace-nowrap transition-opacity duration-150 ease-out",
                expanded ? "opacity-100 delay-[60ms]" : "opacity-0 hidden"
              )}>
                {activeModule === 'studio' ? 'Lunari Studio' : 'Lunari Gallery'}
              </span>
            </div>
            
            <ChevronDown 
              size={14} 
              className={cn(
                "text-muted-foreground/70 shrink-0 transition-opacity duration-150", 
                expanded ? "opacity-100 delay-[60ms]" : "opacity-0 hidden"
              )} 
            />
          </button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align={expanded ? "start" : "center"} side={expanded ? "bottom" : "right"} className="w-[200px]" sideOffset={expanded ? 4 : 10}>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Produtos</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            className="flex flex-col items-start cursor-pointer py-2 px-3 focus:bg-accent focus:text-accent-foreground"
            onClick={() => handleSelectModule('studio')}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 font-medium">
                <LayoutGrid size={14} className="text-muted-foreground" />
                Lunari Studio
              </div>
              {activeModule === 'studio' && <Check size={14} className="text-primary" />}
            </div>
            <span className="text-xs text-muted-foreground pl-6">Gestão</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            className="flex flex-col items-start cursor-pointer py-2 px-3 focus:bg-accent focus:text-accent-foreground"
            onClick={() => handleSelectModule('gallery')}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 font-medium">
                <ImageIcon size={14} className="text-muted-foreground" />
                Lunari Gallery
              </div>
              {activeModule === 'gallery' && <Check size={14} className="text-primary" />}
            </div>
            <span className="text-xs text-muted-foreground pl-6">Seleção e entrega</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
