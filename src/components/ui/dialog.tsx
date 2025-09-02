import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Context for tracking dropdown state within dialogs
const DialogDropdownContext = React.createContext<{
  setHasOpenDropdown: (open: boolean) => void;
} | null>(null);
export const useDialogDropdownContext = () => {
  return React.useContext(DialogDropdownContext);
};
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(({
  className,
  ...props
}, ref) => <DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-40 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(({
  className,
  children,
  ...props
}, ref) => {
  const [hasOpenDropdown, setHasOpenDropdown] = React.useState(false);

  // Auto-cleanup when dialog state changes
  React.useEffect(() => {
    return () => {
      // Force cleanup any lingering dropdown state
      setHasOpenDropdown(false);

      // Aggressive cleanup of orphaned Radix Select portals
      setTimeout(() => {
        const portals = document.querySelectorAll('[data-radix-select-content]');
        portals.forEach(portal => {
          if (portal.parentNode) {
            portal.parentNode.removeChild(portal);
          }
        });

        // Reset pointer events on any stuck overlays
        const overlays = document.querySelectorAll('.radix-select-overlay, [data-radix-select-trigger]');
        overlays.forEach(overlay => {
          (overlay as HTMLElement).style.pointerEvents = '';
        });
      }, 100);
    };
  }, []);

  // Force close dropdowns when dialog closes
  React.useEffect(() => {
    // Reset dropdown state when dialog unmounts or props change
    return () => {
      setHasOpenDropdown(false);
    };
  }, []);
  const handlePointerDownOutside = React.useCallback((event: CustomEvent<{
    originalEvent: PointerEvent;
  }>) => {
    // Don't close modal if there's an open dropdown inside it
    if (hasOpenDropdown) {
      event.preventDefault();
      return;
    }

    // Check if the click target is inside a select dropdown
    const target = event.detail.originalEvent.target as Element;
    if (target && target.closest('[data-radix-select-content]')) {
      event.preventDefault();
      return;
    }
    props.onPointerDownOutside?.(event);
  }, [hasOpenDropdown, props]);

  // Provide context for tracking dropdown state
  const contextValue = React.useMemo(() => ({
    setHasOpenDropdown
  }), []);
  return <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content ref={ref} className={cn("fixed left-1/2 top-1/2 z-40 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg sm:rounded-lg outline-none focus:outline-none max-h-[85vh] overflow-auto scrollbar-elegant will-change-transform data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0", className)} onPointerDownOutside={handlePointerDownOutside} {...props}>
        <DialogDropdownContext.Provider value={contextValue}>
          {children}
        </DialogDropdownContext.Provider>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>;
});
DialogContent.displayName = DialogPrimitive.Content.displayName;
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />;
DialogHeader.displayName = "DialogHeader";
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;
DialogFooter.displayName = "DialogFooter";
const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({
  className,
  ...props
}, ref) => <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />);
DialogTitle.displayName = DialogPrimitive.Title.displayName;
const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(({
  className,
  ...props
}, ref) => <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />);
DialogDescription.displayName = DialogPrimitive.Description.displayName;
export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogDropdownContext };