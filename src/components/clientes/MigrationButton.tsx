/**
 * Migration button component to help users migrate from localStorage to Supabase
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Upload } from 'lucide-react';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';

export function MigrationButton() {
  const [isMigrating, setIsMigrating] = useState(false);
  const { migrarLocalStorageClientes } = useClientesRealtime();

  const handleMigration = async () => {
    const localClientes = JSON.parse(localStorage.getItem('clientes') || '[]');
    
    if (localClientes.length === 0) {
      toast.info('Nenhum cliente encontrado no armazenamento local para migrar');
      return;
    }

    try {
      setIsMigrating(true);
      await migrarLocalStorageClientes();
    } catch (error) {
      console.error('Migration error:', error);
    } finally {
      setIsMigrating(false);
    }
  };

  // Check if there are clients to migrate
  const localClientes = JSON.parse(localStorage.getItem('clientes') || '[]');
  
  if (localClientes.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-6">
      <div className="flex items-center gap-3 mb-3">
        <Database className="h-5 w-5 text-primary" />
        <h3 className="font-medium text-foreground">Migração para Supabase</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Encontramos {localClientes.length} cliente(s) no armazenamento local. 
        Migre para o Supabase para ter sincronização em tempo real e backup seguro.
      </p>
      <Button 
        onClick={handleMigration}
        disabled={isMigrating}
        className="gap-2"
        size="sm"
      >
        {isMigrating ? (
          <>
            <Upload className="h-4 w-4 animate-spin" />
            Migrando...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Migrar Clientes
          </>
        )}
      </Button>
    </div>
  );
}