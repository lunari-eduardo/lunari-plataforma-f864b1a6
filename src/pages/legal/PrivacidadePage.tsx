import { LegalPageShell } from "./LegalPageShell";

export default function PrivacidadePage() {
  return (
    <LegalPageShell
      title="Política de Privacidade"
      updatedAt="03 de agosto de 2026"
      content={
        <>
          <section>
            <h2 className="text-xl mt-8 mb-4">1. Introdução</h2>
            <p>A Lunari respeita sua privacidade e está comprometida com a proteção dos dados pessoais de seus usuários.</p>
            <p>Esta Política de Privacidade explica quais informações coletamos, como elas são utilizadas, armazenadas, compartilhadas e protegidas durante a utilização da plataforma Lunari e de seus serviços relacionados.</p>
            <p>Ao utilizar nossos serviços, você declara estar ciente das práticas descritas neste documento.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">2. Quem somos</h2>
            <p>A Lunari é uma plataforma online voltada à gestão de fotógrafos e estúdios fotográficos, oferecendo recursos como gestão financeira, agenda, CRM, workflow, orçamentos, precificação, galerias e recursos de inteligência artificial.</p>
            <p>Enquanto a empresa estiver em processo de formalização, as atividades são exercidas por seu responsável legal.</p>
            <p><strong>Contato oficial:</strong> contato@lunarihub.com</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">3. Quais dados coletamos</h2>
            <p>Durante a utilização da plataforma podemos coletar diferentes categorias de informações:</p>
            <ul className="list-disc pl-5 space-y-2 mt-4">
              <li><strong>Dados de cadastro:</strong> Nome, e-mail, foto de perfil, senha criptografada e identificadores de autenticação.</li>
              <li><strong>Dados da conta:</strong> Informações cadastradas pelo fotógrafo (clientes, agenda, financeiro, contratos, etc).</li>
              <li><strong>Dados das galerias:</strong> Fotografias, miniaturas, seleções, downloads e metadados técnicos.</li>
              <li><strong>Dados de utilização:</strong> Navegador, sistema operacional, endereço IP, páginas acessadas e logs de erro.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">4. Dados dos clientes do fotógrafo</h2>
            <p>A Lunari permite que fotógrafos armazenem informações de seus próprios clientes. Esses dados pertencem ao fotógrafo.</p>
            <p>Nesse contexto, o fotógrafo atua como <strong>Controlador dos Dados</strong> (nos termos da LGPD) e a Lunari atua como <strong>Operadora</strong>, tratando essas informações apenas para prestar os serviços contratados.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">5. Como utilizamos seus dados</h2>
            <p>Os dados coletados podem ser utilizados para fornecer os serviços, autenticar usuários, sincronizar agendas, armazenar galerias, processar integrações, melhorar recursos, prevenir fraudes e cumprir obrigações legais.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">6. Inteligência Artificial</h2>
            <p>A Lunari poderá disponibilizar recursos de Inteligência Artificial para auxiliar o usuário. Esses recursos utilizam informações autorizadas (agenda, financeiro, etc) exclusivamente para fornecer funcionalidades relacionadas ao uso da plataforma.</p>
            <p><strong>A Lunari não utiliza esses dados para treinamento de modelos próprios de Inteligência Artificial.</strong></p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">7. Integrações com terceiros</h2>
            <p>Mediante autorização, integramos com Google, Mercado Pago, Asaas, InfinitePay e WhatsApp. Cada integração acessa apenas as permissões autorizadas e pode ser revogada a qualquer momento.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">8. Pagamentos</h2>
            <p>A Lunari não recebe valores pagos pelos clientes finais dos fotógrafos. Todos os pagamentos são processados diretamente pelas contas dos próprios fotógrafos junto aos respectivos provedores.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">9. Armazenamento dos dados</h2>
            <p>Utilizamos infraestrutura de provedores especializados: Supabase (banco de dados), Cloudflare R2 (arquivos) e Vercel (hospedagem).</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">10. Segurança</h2>
            <p>Empregamos medidas técnicas e administrativas, incluindo conexões criptografadas (HTTPS), autenticação segura e monitoramento contínuo.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">11. Compartilhamento</h2>
            <p>A Lunari não vende dados pessoais. O compartilhamento ocorre apenas para prestação de serviços, integrações autorizadas ou cumprimento legal.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">12. Retenção e Exclusão</h2>
            <p>Caso o usuário solicite a exclusão da conta, os dados permanecem em retenção por até 30 dias para possibilitar recuperação. Após esse período, são permanentemente excluídos.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">13. Direitos do usuário</h2>
            <p>Nos termos da LGPD, você tem direito ao acesso, correção, portabilidade, exclusão e revogação de consentimento através do e-mail <strong>contato@lunarihub.com</strong>.</p>
          </section>
        </>
      }
    />
  );
}
