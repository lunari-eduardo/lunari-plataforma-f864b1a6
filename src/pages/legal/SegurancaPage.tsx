import { LegalPageShell } from "./LegalPageShell";

export default function SegurancaPage() {
  return (
    <LegalPageShell
      title="Segurança e Conformidade"
      updatedAt="03 de agosto de 2026"
      content={
        <>
          <section>
            <h2 className="text-xl mt-8 mb-4">Nosso Compromisso</h2>
            <p>Na Lunari, a segurança não é um recurso adicional — ela faz parte da arquitetura da plataforma. Protegemos seus dados financeiros, contratos, agendas e galerias seguindo princípios de privacidade e confiabilidade.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">Infraestrutura</h2>
            <p>Utilizamos provedores reconhecidos mundialmente para garantir estabilidade e proteção:</p>
            <ul className="list-disc pl-5 space-y-2 mt-4">
              <li><strong>Supabase:</strong> Banco de dados e autenticação segura.</li>
              <li><strong>Cloudflare R2:</strong> Armazenamento de alta disponibilidade para fotografias.</li>
              <li><strong>Vercel:</strong> Hospedagem global com baixa latência.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">Proteção Técnica</h2>
            <ul className="list-disc pl-5 space-y-2 mt-4">
              <li><strong>Criptografia:</strong> Toda comunicação é protegida via HTTPS (TLS).</li>
              <li><strong>Isolamento:</strong> Cada conta possui acesso restrito apenas aos seus próprios dados.</li>
              <li><strong>Controle de Acesso:</strong> Mecanismos rigorosos de autenticação e sessões protegidas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">Privacidade e LGPD</h2>
            <p>Atuamos em conformidade com a Lei Geral de Proteção de Dados brasileira. O fotógrafo atua como Controlador e a Lunari como Operadora da infraestrutura tecnológica.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">Inteligência Artificial</h2>
            <p>Funcionalidades de IA acessam apenas dados autorizados para prestar assistência e não são utilizadas para treinamento de modelos de terceiros pela plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">Vulnerabilidades</h2>
            <p>Caso identifique qualquer comportamento inesperado ou vulnerabilidade, entre em contato através do e-mail: <strong>contato@lunarihub.com</strong>.</p>
          </section>
        </>
      }
    />
  );
}
