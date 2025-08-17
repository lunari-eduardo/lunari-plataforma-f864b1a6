import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

const SelectModal = SelectPrimitive.Root

const SelectModalGroup = SelectPrimitive.Group

const SelectModalValue = SelectPrimitive.Value

const SelectModalTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-7 w-full items-center justify-between rounded-md bg-lunar-surface px-3 py-1 text-xs text-lunar-text shadow-sm border border-transparent transition-all duration-150 placeholder:text-lunar-textSecondary placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-lunar-accent focus:border-lunar-accent disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-3 w-3 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectModalTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectModalScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectModalScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectModalScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectModalScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

interface SelectModalContentProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  container?: HTMLElement;
}

const SelectModalContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectModalContentProps
>(({ className, children, position = "popper", container, ...props }, ref) => {
  // Find the modal container or use document.body as fallback
  const modalContainer = React.useMemo(() => {
    if (container) return container;
    
    // Try to find the modal dialog element in the DOM
    const dialogElement = document.querySelector('[role="dialog"]');
    if (dialogElement) return dialogElement as HTMLElement;
    
    return document.body;
  }, [container]);

  // Auto-cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Force cleanup any event listeners or state
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
      
      // Aggressive cleanup of select portals that might be stuck
      setTimeout(() => {
        const portals = document.querySelectorAll('[data-radix-select-content]');
        portals.forEach(portal => {
          if (portal.parentNode) {
            portal.parentNode.removeChild(portal);
          }
        });
        
        // Reset pointer events on overlays
        const overlays = document.querySelectorAll('.radix-select-overlay, [data-radix-select-trigger]');
        overlays.forEach(overlay => {
          (overlay as HTMLElement).style.pointerEvents = '';
        });
      }, 100);
    };
  }, []);

  return (
    <SelectPrimitive.Portal container={modalContainer}>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-[60] max-h-96 min-w-[8rem] overflow-hidden rounded-md bg-lunar-bg text-lunar-text shadow-lunar-md border border-lunar-border/50 scrollbar-minimal data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        <SelectModalScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectModalScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
SelectModalContent.displayName = SelectPrimitive.Content.displayName

const SelectModalLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-xs font-medium", className)}
    {...props}
  />
))
SelectModalLabel.displayName = SelectPrimitive.Label.displayName

const SelectModalItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none focus:bg-lunar-surface focus:text-lunar-text data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3 w-3" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectModalItem.displayName = SelectPrimitive.Item.displayName

const SelectModalSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-lunar-border/50", className)}
    {...props}
  />
))
SelectModalSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  SelectModal,
  SelectModalGroup,
  SelectModalValue,
  SelectModalTrigger,
  SelectModalContent,
  SelectModalLabel,
  SelectModalItem,
  SelectModalSeparator,
  SelectModalScrollUpButton,
  SelectModalScrollDownButton,
}