import { LegalPageShell } from "./LegalPageShell";

export default function ExclusaoDadosPage() {
  return (
    <LegalPageShell
      title="Política de Exclusão de Dados"
      updatedAt="03 de agosto de 2026"
      content={
        <>
          <section>
            <h2 className="text-xl mt-8 mb-4">1. Objetivo</h2>
            <p>Esta Política explica como funciona a solicitação de exclusão de conta, quais informações são removidas e quais poderão ser mantidas temporariamente.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">2. Como Solicitar</h2>
            <p>A solicitação pode ser feita diretamente nas configurações da plataforma (Minha Conta) ou através do e-mail <strong>contato@lunarihub.com</strong>.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">3. Efeitos da Solicitação</h2>
            <p>Após a solicitação, a conta é desativada e o acesso bloqueado imediatamente, iniciando o período de retenção.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">4. Período de Retenção (30 dias)</h2>
            <p>Os dados permanecem armazenados por 30 dias para possibilitar recuperação em caso de arrependimento ou exclusão acidental. Após este prazo, a remoção é definitiva.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">5. Dados Removidos</h2>
            <p>Serão excluídos: perfil, configurações, dados de gestão (clientes, agenda, financeiro), orçamentos, contratos e todas as galerias/fotografias.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">6. Dados Mantidos</h2>
            <p>Informações necessárias para cumprimento de obrigações legais, prevenção de fraudes ou determinações judiciais podem ser mantidas pelo período legal exigido.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">7. Integrações e Backups</h2>
            <p>A exclusão na Lunari não revoga automaticamente permissões em serviços externos (Google, Asaas, etc). Recomendamos que o usuário faça backup de arquivos essenciais antes de solicitar a exclusão.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">8. Segurança e Prazos</h2>
            <p>Os dados em retenção continuam protegidos pelos mesmos mecanismos da plataforma. Buscamos processar solicitações no menor prazo possível.</p>
          </section>
        </>
      }
    />
  );
}
