
import { Orcamento } from '@/types/orcamentos';
import { formatDateForDisplay } from './dateUtils';

export const gerarPDFOrcamento = async (orcamento: Orcamento): Promise<string> => {
  // Simula geração de PDF retornando uma URL mockada
  console.log('Gerando PDF para orçamento:', orcamento.id);
  
  // Em uma implementação real, você usaria html2pdf ou jsPDF
  // Por agora, retorna uma URL simulada
  return `https://example.com/orcamento-${orcamento.id}.pdf`;
};

export const gerarHTMLOrcamento = (orcamento: Orcamento): string => {
  const valorFinal = orcamento.valorManual || orcamento.valorTotal;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Orçamento - ${orcamento.cliente.nome}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .cliente { margin-bottom: 20px; }
        .detalhes { margin: 20px 0; white-space: pre-line; }
        .pacotes { margin: 20px 0; }
        .total { font-size: 1.2em; font-weight: bold; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Orçamento</h1>
        <p>Data: ${formatDateForDisplay(orcamento.data)}</p>
      </div>
      
      <div class="cliente">
        <h3>Cliente: ${orcamento.cliente.nome}</h3>
        <p>E-mail: ${orcamento.cliente.email}</p>
        <p>WhatsApp: ${orcamento.cliente.telefone}</p>
      </div>
      
      <div class="detalhes">
        <h3>Detalhes do Serviço:</h3>
        <p>${orcamento.detalhes}</p>
      </div>
      
      ${orcamento.pacotes.length > 0 ? `
        <div class="pacotes">
          <h3>Pacotes e Produtos:</h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantidade</th>
                <th>Valor Unitário</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${orcamento.pacotes.map(p => `
                <tr>
                  <td>${p.nome}</td>
                  <td>${p.quantidade}</td>
                  <td>R$ ${p.preco.toFixed(2)}</td>
                  <td>R$ ${(p.preco * p.quantidade).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      
      <div class="total">
        <p>Valor Total: R$ ${valorFinal.toFixed(2)}</p>
      </div>
    </body>
    </html>
  `;
};
