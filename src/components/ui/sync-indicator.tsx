/**
 * Visual indicator for real-time sync status
 * Shows when data is being synchronized with Supabase
 */

import React from 'react';
import { Loader2, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncIndicatorProps {
  syncing: boolean;
  error?: boolean;
  className?: string;
}

export function SyncIndicator({ syncing, error, className }: SyncIndicatorProps) {
  if (error) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-destructive", className)}>
        <WifiOff className="h-3 w-3" />
        <span>Erro de sincronização</span>
      </div>
    );
  }

  if (syncing) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Sincronizando...</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground opacity-50", className)}>
      <CheckCircle className="h-3 w-3" />
      <span>Sincronizado</span>
    </div>
  );
}

interface TableSyncStatusProps {
  categoriasSyncing: boolean;
  pacotesSyncing: boolean;
  produtosSyncing: boolean;
  etapasSyncing: boolean;
  className?: string;
}

export function TableSyncStatus({ 
  categoriasSyncing, 
  pacotesSyncing, 
  produtosSyncing, 
  etapasSyncing,
  className 
}: TableSyncStatusProps) {
  const isAnySyncing = categoriasSyncing || pacotesSyncing || produtosSyncing || etapasSyncing;

  if (!isAnySyncing) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400", className)}>
        <Wifi className="h-3 w-3" />
        <span>Dados sincronizados</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400", className)}>
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Sincronizando configurações...</span>
    </div>
  );
}