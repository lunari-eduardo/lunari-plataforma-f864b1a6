import { useState, useMemo, useEffect } from 'react';
import { TransacaoFinanceira, CategoriaFinanceira, SubcategoriaFinanceira, ResumoFinanceiro, FiltroTransacao, TipoCategoria, StatusParcela, IndicadoresFinanceiros, ConfiguracaoParcelamento } from '@/types/financas';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { getCurrentDateString, parseDateFromStorage } from '@/utils/dateUtils';

// Sistema inicializado com dados vazios



export function useFinancas() {
  const [transacoes, setTransacoes] = useState<TransacaoFinanceira[]>(() => {
    return storage.load(STORAGE_KEYS.TRANSACTIONS, []);
  });
  
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>(() => {
    return storage.load(STORAGE_KEYS.CATEGORIES, []);
  });
  
  const [descricoesConhecidas, setDescricoesConhecidas] = useState<string[]>(() => {
    return storage.load(STORAGE_KEYS.DESCRIPTIONS, []);
  });

  const [filtro, setFiltro] = useState<FiltroTransacao>(() => {
    const hoje = getCurrentDateString();
    const [ano, mes] = hoje.split('-').map(Number);
    return {
      tipo: 'todas',
      mes,
      ano
    };
  });
  const [mesesVisitados, setMesesVisitados] = useState<Set<string>>(new Set());

  // Save to localStorage whenever data changes
  useEffect(() => {
    storage.save(STORAGE_KEYS.TRANSACTIONS, transacoes);
  }, [transacoes]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.CATEGORIES, categorias);
  }, [categorias]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.DESCRIPTIONS, descricoesConhecidas);
  }, [descricoesConhecidas]);

  // Automação de status - verifica e atualiza status vencidos
  useEffect(() => {
    const hoje = getCurrentDateString();
    
    setTransacoes(prev => {
      const transacoesAtualizadas = prev.map(transacao => {
        // Muda de 'agendado' para 'pago' quando a data vence (removendo 'faturado')
        if (transacao.data <= hoje && transacao.status === 'agendado') {
          return { ...transacao, status: 'pago' as StatusParcela };
        }
        return transacao;
      });

      const houveMudancas = transacoesAtualizadas.some((t, index) => t.status !== prev[index].status);
      return houveMudancas ? transacoesAtualizadas : prev;
    });
  }, []);

  // Nova lógica para despesas recorrentes
  useEffect(() => {
    const mesAtual = filtro.mes;
    const anoAtual = filtro.ano;
    const chaveAtual = `${anoAtual}-${mesAtual}`;
    
    if (mesesVisitados.has(chaveAtual)) {
      return; // Já visitou este mês, não cria novamente
    }

    // Marca o mês como visitado
    setMesesVisitados(prev => new Set(prev).add(chaveAtual));
    
    // Calcula o mês anterior
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
    const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual;
    
    // Busca despesas recorrentes do mês anterior
    const despesasRecorrentesAnterior = transacoes.filter(t => {
      const [anoData, mesData] = t.data.split('-').map(Number);
      const categoria = categorias.find(c => c.id === t.categoriaId);
      return t.isRecorrente === true && 
             categoria?.tipo === 'despesa_fixa' && 
             mesData === mesAnterior && 
             anoData === anoAnterior &&
             t.tipoRecorrencia === 'unica'; // Só copia despesas únicas recorrentes
    });

    // Verifica se já existem despesas recorrentes no mês atual
    const despesasRecorrentesAtual = transacoes.filter(t => {
      const [anoData, mesData] = t.data.split('-').map(Number);
      return t.isRecorrente === true && 
             mesData === mesAtual && 
             anoData === anoAtual;
    });

    // Se há despesas recorrentes no mês anterior e não há no atual, criar automaticamente
    if (despesasRecorrentesAnterior.length > 0 && despesasRecorrentesAtual.length === 0) {
      const novasDespesasRecorrentes = despesasRecorrentesAnterior.map(despesa => {
        const diaOriginal = despesa.data.split('-')[2];
        return {
          ...despesa,
          id: `${Date.now()}_${Math.random()}`,
          data: `${anoAtual}-${mesAtual.toString().padStart(2, '0')}-${diaOriginal}`,
          status: 'agendado' as StatusParcela,
          criadoEm: getCurrentDateString()
        };
      });

      setTransacoes(prev => [...prev, ...novasDespesasRecorrentes]);
      console.log('Despesas recorrentes criadas automaticamente para', mesAtual, anoAtual);
    }
  }, [filtro.mes, filtro.ano, transacoes, categorias, mesesVisitados]);

  const transacoesFiltradas = useMemo(() => {
    return transacoes.filter(transacao => {
      const [anoTransacao, mesTransacao] = transacao.data.split('-').map(Number);

      // Filtro por mês/ano
      const mesAnoMatch = mesTransacao === filtro.mes && anoTransacao === filtro.ano;

      // Filtro por tipo
      let tipoMatch = true;
      if (filtro.tipo === 'agendadas') {
        tipoMatch = transacao.status === 'agendado';
      } else if (filtro.tipo === 'despesa_fixa') {
        const categoria = categorias.find(c => c.id === transacao.categoriaId);
        tipoMatch = categoria?.tipo === 'despesa_fixa';
      } else if (filtro.tipo === 'despesa_variavel') {
        const categoria = categorias.find(c => c.id === transacao.categoriaId);
        tipoMatch = categoria?.tipo === 'despesa_variavel' || categoria?.tipo === 'investimento';
      } else if (filtro.tipo === 'receita_nao_operacional') {
        const categoria = categorias.find(c => c.id === transacao.categoriaId);
        tipoMatch = categoria?.tipo === 'receita_nao_operacional';
      }

      // Filtro por categoria
      const categoriaMatch = !filtro.categoria || transacao.categoriaId === filtro.categoria;

      return mesAnoMatch && tipoMatch && categoriaMatch;
    });
  }, [transacoes, filtro, categorias]);

  const indicadoresFinanceiros = useMemo((): IndicadoresFinanceiros => {
    const transacoesMes = transacoes.filter(t => {
      const [anoTransacao, mesTransacao] = t.data.split('-').map(Number);
      return mesTransacao === filtro.mes && anoTransacao === filtro.ano;
    });

    const custoPrevisto = transacoesMes
      .filter(t => t.tipo === 'despesa')
      .reduce((sum, t) => sum + t.valor, 0);

    const custoTotal = transacoesMes
      .filter(t => t.tipo === 'despesa' && t.status === 'pago')
      .reduce((sum, t) => sum + t.valor, 0);

    return { custoPrevisto, custoTotal };
  }, [transacoes, filtro]);

  const resumoFinanceiro = useMemo((): ResumoFinanceiro => {
    const transacoesMes = transacoes.filter(t => {
      const [anoTransacao, mesTransacao] = t.data.split('-').map(Number);
      return mesTransacao === filtro.mes && anoTransacao === filtro.ano;
    });
    
    const totalReceitasExtras = transacoesMes
      .filter(t => t.tipo === 'receita')
      .reduce((sum, t) => sum + t.valor, 0);

    const totalDespesas = transacoesMes
      .filter(t => t.tipo === 'despesa' && t.status === 'pago')
      .reduce((sum, t) => sum + t.valor, 0);

    const receitaOperacional = 8500; // Virá do Workflow futuramente
    const resultadoMensal = (receitaOperacional + totalReceitasExtras) - totalDespesas;
    const lucroLiquido = resultadoMensal;

    return {
      totalReceitasExtras,
      totalDespesas,
      receitaOperacional,
      resultadoMensal,
      lucroLiquido,
      custoPrevisto: indicadoresFinanceiros.custoPrevisto,
      custoTotal: indicadoresFinanceiros.custoTotal
    };
  }, [transacoes, filtro, indicadoresFinanceiros]);

  const categoriasPorTipo = useMemo(() => {
    const grupos: Record<TipoCategoria, CategoriaFinanceira[]> = {
      despesa_fixa: [],
      despesa_variavel: [],
      receita_nao_operacional: [],
      investimento: [],
      equipamento: [],
      marketing: [],
      acervo: []
    };

    categorias.forEach(categoria => {
      if (categoria.ativo && grupos[categoria.tipo]) {
        grupos[categoria.tipo].push(categoria);
      }
    });

    return grupos;
  }, [categorias]);

  const adicionarNovaDescricao = (descricao: string) => {
    if (!descricoesConhecidas.includes(descricao)) {
      setDescricoesConhecidas(prev => [...prev, descricao]);
    }
  };

  const adicionarTransacao = (novaTransacao: Omit<TransacaoFinanceira, 'id' | 'userId' | 'criadoEm'>, config?: ConfiguracaoParcelamento) => {
    console.log('Adicionando transação:', novaTransacao, config);

    // Salva a descrição na lista de conhecidas
    if (novaTransacao.descricao) {
      adicionarNovaDescricao(novaTransacao.descricao);
    }

    if (config?.tipo === 'parcelado' && config.quantidadeParcelas > 1) {
      const transacoesParcelas: TransacaoFinanceira[] = [];
      const lançamentoPaiId = Date.now().toString();
      const valorParcela = novaTransacao.valor / config.quantidadeParcelas;

      for (let i = 1; i <= config.quantidadeParcelas; i++) {
        const [anoInicio, mesInicio, diaInicio] = config.dataInicio.split('-').map(Number);
        let anoParcelа = anoInicio;
        let mesParcelа = mesInicio + (i - 1);
        
        // Ajustar ano se mês passar de 12
        while (mesParcelа > 12) {
          mesParcelа -= 12;
          anoParcelа++;
        }
        
        const dataParcelaString = `${anoParcelа}-${mesParcelа.toString().padStart(2, '0')}-${diaInicio.toString().padStart(2, '0')}`;
        const hoje = getCurrentDateString();
        
        const status = dataParcelaString <= hoje ? 'pago' : 'agendado';
        
        transacoesParcelas.push({
          ...novaTransacao,
          id: `${lançamentoPaiId}_${i}`,
          lançamentoPaiId,
          numeroParcela: i,
          valor: valorParcela,
          data: dataParcelaString,
          status: status as StatusParcela,
          userId: 'user1',
          criadoEm: getCurrentDateString()
        });
      }

      setTransacoes(prev => [...prev, ...transacoesParcelas]);
    } else {
      // Transação única
      const hoje = getCurrentDateString();
      const status = novaTransacao.data <= hoje ? 'pago' : 'agendado';

      const transacao: TransacaoFinanceira = {
        ...novaTransacao,
        id: Date.now().toString(),
        status: status as StatusParcela,
        userId: 'user1',
        criadoEm: getCurrentDateString()
      };

      setTransacoes(prev => [...prev, transacao]);
    }
  };

  const atualizarTransacao = (id: string, dadosAtualizados: Partial<TransacaoFinanceira>) => {
    console.log('Atualizando transação:', id, dadosAtualizados);
    
    // Se a descrição foi atualizada, salva na lista
    if (dadosAtualizados.descricao) {
      adicionarNovaDescricao(dadosAtualizados.descricao);
    }
    
    setTransacoes(prev => 
      prev.map(t => t.id === id ? { ...t, ...dadosAtualizados } : t)
    );
  };

  const removerTransacao = (id: string) => {
    const transacao = transacoes.find(t => t.id === id);
    console.log('Removendo transação:', id, transacao);
    
    if (transacao?.lançamentoPaiId) {
      // Remove todas as parcelas relacionadas
      setTransacoes(prev => 
        prev.filter(t => t.lançamentoPaiId !== transacao.lançamentoPaiId)
      );
    } else {
      setTransacoes(prev => prev.filter(t => t.id !== id));
    }
  };

  const adicionarCategoria = (novaCategoria: Omit<CategoriaFinanceira, 'id' | 'userId' | 'criadoEm'>) => {
    const categoria: CategoriaFinanceira = {
      ...novaCategoria,
      id: Date.now().toString(),
      userId: 'user1',
      criadoEm: getCurrentDateString()
    };

    setCategorias(prev => [...prev, categoria]);
  };

  const removerCategoria = (categoriaId: string) => {
    setCategorias(prev => prev.filter(c => c.id !== categoriaId));
    // Remove também as transações associadas
    setTransacoes(prev => prev.filter(t => t.categoriaId !== categoriaId));
  };

  const adicionarSubcategoria = (categoriaId: string, nomeSubcategoria: string) => {
    const novaSubcategoria: SubcategoriaFinanceira = {
      id: Date.now().toString(),
      nome: nomeSubcategoria,
      categoriaId,
      userId: 'user1',
      ativo: true,
      criadoEm: getCurrentDateString()
    };

    setCategorias(prev => 
      prev.map(categoria => 
        categoria.id === categoriaId
          ? { 
              ...categoria, 
              subcategorias: [...(categoria.subcategorias || []), novaSubcategoria] 
            }
          : categoria
      )
    );
  };

  const filtrarTransacoesPorTipo = (tipo: 'despesa_fixa' | 'despesa_variavel' | 'receita_nao_operacional') => {
    return transacoesFiltradas.filter(t => {
      const categoria = categorias.find(c => c.id === t.categoriaId);
      if (tipo === 'despesa_variavel') {
        return categoria?.tipo === 'despesa_variavel' || categoria?.tipo === 'investimento';
      }
      return categoria?.tipo === tipo;
    });
  };

  return {
    transacoes: transacoesFiltradas,
    categorias,
    categoriasPorTipo,
    resumoFinanceiro,
    indicadoresFinanceiros,
    filtro,
    setFiltro,
    descricoesConhecidas,
    adicionarNovaDescricao,
    adicionarTransacao,
    atualizarTransacao,
    removerTransacao,
    adicionarCategoria,
    removerCategoria,
    adicionarSubcategoria,
    filtrarTransacoesPorTipo
  };
}
