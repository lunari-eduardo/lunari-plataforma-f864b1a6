import { SessionData } from '@/types/workflow';
import { WorkflowSession } from './types';

const fmtBRL = (n: any) => `R$ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`;

export const convertToSessionData = async (session: WorkflowSession): Promise<SessionData> => {
  try {
    let packageName = session.pacote || '';
    let packageValue: number = Number(session.valor_total) || 0;
    let packageFotoExtraValue = 35;

    if (session.pacote) {
      try {
        const { configurationService } = await import('@/services/ConfigurationService');
        const packages = configurationService.loadPacotes();
        const pkg = packages.find((p: any) => p.id === session.pacote || p.nome === session.pacote);
        if (pkg) {
          packageName = pkg.nome;
          packageValue = Number(pkg.valor_base) || Number(session.valor_total) || 0;
          packageFotoExtraValue = Number(pkg.valor_foto_extra) || 35;
        } else {
          packageName = session.pacote;
        }
      } catch (error) {
        console.warn('Error loading package data:', error);
        packageName = session.pacote;
      }
    }

    const valorTotalNum = Number(session.valor_total) || 0;
    const valorPagoNum = Number(session.valor_pago) || 0;

    return {
      id: session.id,
      data: session.data_sessao,
      hora: session.hora_sessao,
      nome: (session as any).clientes?.nome || '',
      email: (session as any).clientes?.email || '',
      descricao: session.descricao || '',
      status: session.status,
      whatsapp: (session as any).clientes?.telefone || '',
      categoria: session.categoria,
      pacote: packageName,
      valorPacote: fmtBRL(packageValue),
      valorFotoExtra: fmtBRL(session.valor_foto_extra ?? packageFotoExtraValue),
      qtdFotosExtra: session.qtd_fotos_extra || 0,
      valorTotalFotoExtra: fmtBRL(session.valor_total_foto_extra),
      produto: '',
      qtdProduto: 0,
      valorTotalProduto: 'R$ 0,00',
      valorAdicional: fmtBRL(session.valor_adicional),
      detalhes: session.detalhes || '',
      observacoes: session.observacoes || '',
      valor: fmtBRL(valorTotalNum),
      total: fmtBRL(valorTotalNum),
      valorPago: fmtBRL(valorPagoNum),
      restante: fmtBRL(valorTotalNum - valorPagoNum),
      desconto: fmtBRL(session.desconto),
      pagamentos: [],
      produtosList: session.produtos_incluidos || [],
      regrasDePrecoFotoExtraCongeladas: session.regras_congeladas,
      clienteId: session.cliente_id,
    };
  } catch (err) {
    console.warn('convertToSessionData fallback for session', (session as any)?.id, err);
    return {
      id: (session as any)?.id,
      data: (session as any)?.data_sessao,
      hora: (session as any)?.hora_sessao,
      nome: (session as any)?.clientes?.nome || '',
      email: (session as any)?.clientes?.email || '',
      descricao: (session as any)?.descricao || '',
      status: (session as any)?.status,
      whatsapp: (session as any)?.clientes?.telefone || '',
      categoria: (session as any)?.categoria,
      pacote: (session as any)?.pacote || '',
      valorPacote: 'R$ 0,00',
      valorFotoExtra: 'R$ 0,00',
      qtdFotosExtra: 0,
      valorTotalFotoExtra: 'R$ 0,00',
      produto: '',
      qtdProduto: 0,
      valorTotalProduto: 'R$ 0,00',
      valorAdicional: 'R$ 0,00',
      detalhes: (session as any)?.detalhes || '',
      observacoes: (session as any)?.observacoes || '',
      valor: 'R$ 0,00',
      total: 'R$ 0,00',
      valorPago: 'R$ 0,00',
      restante: 'R$ 0,00',
      desconto: 'R$ 0,00',
      pagamentos: [],
      produtosList: (session as any)?.produtos_incluidos || [],
      regrasDePrecoFotoExtraCongeladas: (session as any)?.regras_congeladas,
      clienteId: (session as any)?.cliente_id,
    } as SessionData;
  }
};
