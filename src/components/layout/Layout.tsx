import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { EquipmentSyncNotification } from '@/components/equipments/EquipmentSyncNotification';
import { useEquipmentSync } from '@/hooks/useEquipmentSync';
export default function Layout() {
  const isMobile = useIsMobile();

  // Inicializar monitoramento de equipamentos
  useEquipmentSync();
  return <div className="flex h-screen bg-lunar-bg">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-1 md:p-2 px-[8px] bg-lunar-bg scrollbar-elegant py-0 my-0">
          <div className="animate-lunar">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* Equipment sync notifications */}
      <EquipmentSyncNotification />
    </div>;
}