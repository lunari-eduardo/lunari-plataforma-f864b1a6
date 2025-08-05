import { WorkflowItem } from '@/contexts/AppContext';

// Interface simplificada para receitas mensais
export interface MonthlyRevenue {
  year: number;
  month: number;
  receitaOperacional: number;
  receitasExtras: number;
  totalReceita: number;
}

/**
 * Calculador simplificado de receitas por mês
 * Substitui o sistema complexo do RevenueCache
 */
export class SimpleRevenueCalculator {
  
  /**
   * Calcula receita de workflow para um mês específico
   */
  static calcularReceitaWorkflowMes(
    workflowItems: WorkflowItem[], 
    year: number, 
    month: number
  ): number {
    const itemsFiltrados = workflowItems.filter(item => {
      try {
        const itemDate = new Date(item.data);
        return itemDate.getFullYear() === year && 
               itemDate.getMonth() + 1 === month;
      } catch {
        return false;
      }
    });

    const total = itemsFiltrados.reduce((sum, item) => sum + item.valorPago, 0);
    
    console.log(`💰 [SimpleRevenueCalculator] Ano ${year}, Mês ${month}: ${itemsFiltrados.length} itens, R$ ${total.toFixed(2)}`);
    
    return total;
  }

  /**
   * Calcula receita de workflow para um ano completo
   */
  static calcularReceitaWorkflowAno(
    workflowItems: WorkflowItem[], 
    year: number
  ): number {
    const itemsFiltrados = workflowItems.filter(item => {
      try {
        const itemDate = new Date(item.data);
        return itemDate.getFullYear() === year;
      } catch {
        return false;
      }
    });

    const total = itemsFiltrados.reduce((sum, item) => sum + item.valorPago, 0);
    
    console.log(`💰 [SimpleRevenueCalculator] Ano ${year} completo: ${itemsFiltrados.length} itens, R$ ${total.toFixed(2)}`);
    
    return total;
  }

  /**
   * Obter receitas mensais para gráficos (ano completo)
   */
  static obterDadosMensais(
    workflowItems: WorkflowItem[], 
    year: number
  ): Array<{ mes: string; receita: number; lucro: number }> {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    
    return meses.map((nome, index) => {
      const month = index + 1;
      const receita = this.calcularReceitaWorkflowMes(workflowItems, year, month);
      
      return {
        mes: nome,
        receita,
        lucro: receita // Simplificado - receita como base do lucro
      };
    });
  }

  /**
   * Calcula receita com filtros opcionais
   */
  static calcularReceita(
    workflowItems: WorkflowItem[],
    filtros: {
      year?: number;
      month?: number;
    } = {}
  ): number {
    let itemsFiltrados = workflowItems;

    if (filtros.year) {
      itemsFiltrados = itemsFiltrados.filter(item => {
        try {
          const itemDate = new Date(item.data);
          return itemDate.getFullYear() === filtros.year;
        } catch {
          return false;
        }
      });
    }

    if (filtros.month) {
      itemsFiltrados = itemsFiltrados.filter(item => {
        try {
          const itemDate = new Date(item.data);
          return itemDate.getMonth() + 1 === filtros.month;
        } catch {
          return false;
        }
      });
    }

    return itemsFiltrados.reduce((sum, item) => sum + item.valorPago, 0);
  }
}