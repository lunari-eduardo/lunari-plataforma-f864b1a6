import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';

function isAniversarioNoMes(dataNascimento: string, mes: number): boolean {
  if (!dataNascimento) return false;
  const [ano, mesNasc] = dataNascimento.split('-').map(Number);
  return mesNasc === mes;
}

export function useBirthdayAlert(clientes: Cliente[]) {
  const mesAtual = new Date().getMonth() + 1;

  const totalAniversariantes = useMemo(() => {
    let count = 0;

    clientes.forEach(cliente => {
      // Cliente
      if (cliente.dataNascimento && isAniversarioNoMes(cliente.dataNascimento, mesAtual)) {
        count++;
      }

      // Cônjuge
      if (cliente.conjuge?.dataNascimento && isAniversarioNoMes(cliente.conjuge.dataNascimento, mesAtual)) {
        count++;
      }

      // Filhos
      cliente.filhos?.forEach(filho => {
        if (filho.dataNascimento && isAniversarioNoMes(filho.dataNascimento, mesAtual)) {
          count++;
        }
      });
    });

    return count;
  }, [clientes, mesAtual]);

  return {
    totalAniversariantes,
    mesAtual,
    nomesMeses: [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
  };
}