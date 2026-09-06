import { UserProfile } from '@/services/ProfileService';
import { UserBranding } from '@/types/userProfile';
import { TransacaoComItem } from '@/types/financas';

export const getLogoElement = (branding: UserBranding): string => {
  if (!branding.logoUrl) return '';
  return `<img src="${branding.logoUrl}" alt="Logo da empresa" style="max-height: 60px; max-width: 200px; object-fit: contain;">`;
};

export const getCompanyInfo = (profile: UserProfile): string => {
  return `
    <div class="company-info">
      <h2 class="company-name">${profile.empresa || profile.nome}</h2>
      ${profile.cpf_cnpj ? `<p class="company-doc">CNPJ/CPF: ${profile.cpf_cnpj}</p>` : ''}
      ${profile.endereco_comercial ? `<p class="company-address">${profile.endereco_comercial}</p>` : ''}
      ${profile.email ? `<p class="company-email">${profile.email}</p>` : ''}
    </div>
  `;
};

export const getTransactionsByGroup = (transactions: TransacaoComItem[]): Record<string, TransacaoComItem[]> => {
  const groups: Record<string, TransacaoComItem[]> = {
    'Receita Operacional': [],
    'Receita Não Operacional': [],
    'Despesa Fixa': [],
    'Despesa Variável': [],
    'Investimento': []
  };

  transactions.forEach(transaction => {
    const group = transaction.item.grupo_principal;
    if (groups[group]) {
      groups[group].push(transaction);
    } else {
      console.warn(`Grupo não reconhecido: ${group}. Classificando automaticamente.`);
      if (group?.includes('Receita') || transaction.valor > 0) {
        groups['Receita Não Operacional'].push(transaction);
      } else {
        groups['Despesa Variável'].push(transaction);
      }
    }
  });

  return groups;
};
