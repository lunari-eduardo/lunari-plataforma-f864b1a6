import { useMemo } from 'react';
import { Cliente } from '@/types/cliente';

function isWithinNext30Days(dataNascimento: string): boolean {
  if (!dataNascimento) return false;
  
  const today = new Date();
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  
  // Create birthday date for this year
  let birthdayThisYear = new Date(today.getFullYear(), mes - 1, dia);
  
  // If birthday already passed this year, check next year's birthday
  if (birthdayThisYear < today) {
    birthdayThisYear = new Date(today.getFullYear() + 1, mes - 1, dia);
  }
  
  // Check if birthday is within next 30 days
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  
  return birthdayThisYear <= thirtyDaysFromNow;
}

export function useBirthdayAlert(clientes: Cliente[]) {
  const totalAniversariantes = useMemo(() => {
    let count = 0;

    clientes.forEach(cliente => {
      // Cliente
      if (cliente.dataNascimento && isWithinNext30Days(cliente.dataNascimento)) {
        count++;
      }

      // Cônjuge
      if (cliente.conjuge?.dataNascimento && isWithinNext30Days(cliente.conjuge.dataNascimento)) {
        count++;
      }

      // Filhos
      cliente.filhos?.forEach(filho => {
        if (filho.dataNascimento && isWithinNext30Days(filho.dataNascimento)) {
          count++;
        }
      });
    });

    return count;
  }, [clientes]);

  return {
    totalAniversariantes
  };
}