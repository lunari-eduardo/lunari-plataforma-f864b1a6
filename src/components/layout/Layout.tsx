import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { EquipmentSyncNotification } from '@/components/equipments/EquipmentSyncNotification';
import { useEquipmentSync } from '@/hooks/useEquipmentSync';
import { TrialBanner } from '@/components/subscription/TrialBanner';
import { HelpFloatingButton } from '@/components/help/HelpFloatingButton';
import { cn } from '@/lib/utils';
import InternalBackground from '@/components/backgrounds/InternalBackground';
import DashboardBackground from '@/components/backgrounds/DashboardBackground';

export default function Layout() {
  const isMobile = useIsMobile();
  const location = useLocation();

  // Inicializar monitoramento de equipamentos
  useEquipmentSync();

  const isDashboard = location.pathname === '/app' || location.pathname === '/app/';
  
  return <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Backgrounds */}
        {isDashboard && <DashboardBackground />}
        {!isDashboard && <InternalBackground />}

        <TrialBanner />
        <Header />
        
        <main className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden p-1 md:p-2 px-[8px] scrollbar-elegant py-0 my-0 relative z-10",
          isMobile && "pb-20"
        )}>
          <div className="animate-lunar">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* Equipment sync notifications */}
      <EquipmentSyncNotification />
    </div>;
}
