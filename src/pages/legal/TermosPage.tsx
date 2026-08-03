import { LegalPageShell } from "./LegalPageShell";

export default function TermosPage() {
  return (
    <LegalPageShell
      title="Termos de Uso"
      updatedAt="03 de agosto de 2026"
      content={
        <>
          <section>
            <h2 className="text-xl mt-8 mb-4">1. Aceitação dos Termos</h2>
            <p>Ao criar uma conta ou utilizar a Lunari, você concorda com estes Termos de Uso e com nossa Política de Privacidade. Caso não concorde, não utilize os serviços.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">2. Sobre a Plataforma</h2>
            <p>A Lunari é uma ferramenta de gestão para fotógrafos (Agenda, CRM, Financeiro, Galerias, etc). Novos recursos podem ser adicionados sem alteração individual destes termos.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">3. Cadastro e Elegibilidade</h2>
            <p>O usuário deve fornecer informações verdadeiras e proteger sua senha. É necessário possuir capacidade legal para celebrar contratos.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">4. Planos e Assinaturas</h2>
            <p>Oferecemos planos gratuitos e pagos. Cada plano possui limitações e preços próprios divulgados na plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">5. Pagamentos e Integrações</h2>
            <p>Assinaturas são processadas por terceiros (Asaas, Mercado Pago, etc). A Lunari não armazena dados de cartão de crédito completos.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">6. Inteligência Artificial</h2>
            <p>Recursos de IA têm caráter assistivo. Recomendamos revisar informações importantes antes de tomar decisões baseadas neles.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">7. Conteúdo do Usuário</h2>
            <p>O usuário permanece proprietário de todo conteúdo enviado (fotos, contratos, dados). A Lunari atua apenas como fornecedora da infraestrutura tecnológica.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">8. Uso Permitido e Proibições</h2>
            <p>É proibido utilizar a plataforma para atividades ilícitas, transmitir malware, tentar invasões ou violar direitos de terceiros.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">9. Propriedade Intelectual</h2>
            <p>Todo o software, identidade visual e logotipos da Lunari pertencem à plataforma e não podem ser reproduzidos sem autorização.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">10. Responsabilidades e Limitações</h2>
            <p>A Lunari não se responsabiliza por decisões tomadas pelo usuário, perda de negócios ou falhas em serviços de terceiros integrados.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">11. Cancelamento e Exclusão</h2>
            <p>O usuário pode cancelar a conta a qualquer momento. Os dados seguem a política de retenção de 30 dias antes da exclusão permanente.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">12. Legislação</h2>
            <p>Estes termos são regidos pelas leis do Brasil, incluindo a LGPD e o Código Civil.</p>
          </section>
        </>
      }
    />
  );
}
