import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useIsMobile } from '@/hooks/use-mobile';
export default function Layout() {
  const isMobile = useIsMobile();
  return <div className="flex h-screen bg-lunar-bg">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-hidden p-2 md:p-4 bg-lunar-bg py-px">
          <div className="animate-lunar">
            <Outlet />
          </div>
        </main>
      </div>
    </div>;
}