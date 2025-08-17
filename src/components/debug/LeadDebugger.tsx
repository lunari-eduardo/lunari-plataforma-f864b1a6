import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLeads } from '@/hooks/useLeads';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

export default function LeadDebugger() {
  const { leads } = useLeads();
  const [storageLeads, setStorageLeads] = useState<any[]>([]);
  const [events, setEvents] = useState<string[]>([]);

  // Monitor storage directly
  useEffect(() => {
    const checkStorage = () => {
      const stored = storage.load(STORAGE_KEYS.LEADS, []);
      setStorageLeads(stored);
    };

    const interval = setInterval(checkStorage, 1000);
    checkStorage(); // Initial check

    return () => clearInterval(interval);
  }, []);

  // Monitor events
  useEffect(() => {
    const handleLeadEvent = (e: CustomEvent) => {
      const timestamp = new Date().toLocaleTimeString();
      setEvents(prev => [`${timestamp}: Event received - ${JSON.stringify(e.detail)}`, ...prev.slice(0, 9)]);
    };

    window.addEventListener('leads:changed', handleLeadEvent as EventListener);
    return () => window.removeEventListener('leads:changed', handleLeadEvent as EventListener);
  }, []);

  const clearEvents = () => setEvents([]);

  const clearStorage = () => {
    storage.remove(STORAGE_KEYS.LEADS);
    setStorageLeads([]);
  };

  return (
    <Card className="p-4 space-y-4 bg-red-50 border-red-200">
      <h3 className="font-bold text-red-800">🐛 Lead Debugger</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold">React State ({leads.length})</h4>
          <div className="text-xs max-h-32 overflow-y-auto bg-white p-2 rounded scrollbar-elegant">
            {leads.map(lead => (
              <div key={lead.id} className="border-b py-1">
                {lead.nome} - {lead.origem} ({lead.id.slice(-6)})
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold">Storage ({storageLeads.length})</h4>
          <div className="text-xs max-h-32 overflow-y-auto bg-white p-2 rounded scrollbar-elegant">
            {storageLeads.map((lead: any) => (
              <div key={lead.id} className="border-b py-1">
                {lead.nome} - {lead.origem} ({lead.id?.slice(-6)})
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div>
        <div className="flex justify-between items-center">
          <h4 className="font-semibold">Events Log</h4>
          <div className="space-x-2">
            <Button size="sm" variant="outline" onClick={clearEvents}>Clear Events</Button>
            <Button size="sm" variant="destructive" onClick={clearStorage}>Clear Storage</Button>
          </div>
        </div>
        <div className="text-xs max-h-32 overflow-y-auto bg-white p-2 rounded scrollbar-elegant">
          {events.map((event, idx) => (
            <div key={idx} className="font-mono text-xs py-1 border-b">
              {event}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}