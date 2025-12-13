import { useState, useEffect } from "react";
import { X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAccessControl } from "@/hooks/useAccessControl";

const BANNER_DISMISS_KEY = "trial_banner_dismissed_date";

export function TrialBanner() {
  const [dismissed, setDismissed] = useState(true);
  const navigate = useNavigate();
  const { accessState, loading } = useAccessControl();

  useEffect(() => {
    // Check if banner was already dismissed today
    const dismissedDate = localStorage.getItem(BANNER_DISMISS_KEY);
    const today = new Date().toDateString();
    
    if (dismissedDate !== today) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    const today = new Date().toDateString();
    localStorage.setItem(BANNER_DISMISS_KEY, today);
    setDismissed(true);
  };

  // Don't show if loading, dismissed, not in trial, or more than 7 days remaining
  if (loading || dismissed) return null;
  if (!accessState.isTrial) return null;
  if (accessState.daysRemaining === undefined || accessState.daysRemaining > 7) return null;

  const isUrgent = accessState.daysRemaining <= 3;

  return (
    <div
      className={`w-full px-4 py-2 flex items-center justify-between gap-4 ${
        isUrgent
          ? "bg-orange-500 text-white"
          : "bg-blue-500 text-white"
      }`}
    >
      <div className="flex items-center gap-2 text-sm">
        <Clock className="w-4 h-4" />
        <span>
          {accessState.daysRemaining === 0
            ? "Seu teste termina hoje!"
            : accessState.daysRemaining === 1
            ? "Seu teste termina amanhã!"
            : `Seu teste termina em ${accessState.daysRemaining} dias`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => navigate("/escolher-plano")}
        >
          Escolher plano
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
