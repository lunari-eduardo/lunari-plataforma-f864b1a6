import { useState, useEffect } from 'react';
import { Cliente, OrigemCliente } from '@/types/cliente';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

export const useClientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    return storage.load(STORAGE_KEYS.CLIENTS, []);
  });
  
  const [origens, setOrigens] = useState<OrigemCliente[]>(() => {
    return storage.load(STORAGE_KEYS.ORIGINS, []);
  });

  // Salvar no localStorage sempre que os dados mudarem
  useEffect(() => {
    storage.save(STORAGE_KEYS.CLIENTS, clientes);
  }, [clientes]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.ORIGINS, origens);
  }, [origens]);

  const adicionarCliente = (cliente: Omit<Cliente, 'id'>): Cliente => {
    const novoCliente = {
      ...cliente,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    setClientes(prev => [...prev, novoCliente]);
    return novoCliente;
  };

  const atualizarCliente = (id: string, dadosAtualizados: Partial<Cliente>): void => {
    setClientes(prev => prev.map(cliente => 
      cliente.id === id ? { ...cliente, ...dadosAtualizados } : cliente
    ));
  };

  const removerCliente = (id: string): void => {
    setClientes(prev => prev.filter(cliente => cliente.id !== id));
  };

  const adicionarOrigem = (origem: Omit<OrigemCliente, 'id'>): OrigemCliente => {
    const novaOrigem = {
      ...origem,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    setOrigens(prev => [...prev, novaOrigem]);
    return novaOrigem;
  };

  const atualizarOrigem = (id: string, origem: Partial<OrigemCliente>): void => {
    setOrigens(prev => prev.map(o => 
      o.id === id ? { ...o, ...origem } : o
    ));
  };

  const excluirOrigem = (id: string): void => {
    setOrigens(prev => prev.filter(o => o.id !== id));
  };

  return {
    clientes,
    origens,
    adicionarCliente,
    atualizarCliente,
    removerCliente,
    adicionarOrigem,
    atualizarOrigem,
    excluirOrigem
  };
};