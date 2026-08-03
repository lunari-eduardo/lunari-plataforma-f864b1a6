import { LegalPageShell } from "./LegalPageShell";

export default function CookiesPage() {
  return (
    <LegalPageShell
      title="Política de Cookies"
      updatedAt="03 de agosto de 2026"
      content={
        <>
          <section>
            <h2 className="text-xl mt-8 mb-4">1. O que são cookies?</h2>
            <p>Cookies são pequenos arquivos armazenados em seu navegador para reconhecer sua sessão, lembrar preferências e melhorar a experiência de uso.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">2. Categorias de Cookies</h2>
            <ul className="list-disc pl-5 space-y-4 mt-4">
              <li><strong>Essenciais:</strong> Indispensáveis para login, segurança e manutenção da sessão.</li>
              <li><strong>Preferências:</strong> Lembram idioma, tema e configurações visuais.</li>
              <li><strong>Analíticos:</strong> Ajudam a entender como a plataforma é usada (ex: Google Analytics). As informações são agregadas.</li>
              <li><strong>Segurança:</strong> Protegem contra acessos indevidos e fraudes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">3. Tecnologias Semelhantes</h2>
            <p>Utilizamos também Local Storage e tokens de autenticação para as mesmas finalidades descritas nesta política.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">4. Cookies de Terceiros</h2>
            <p>Funcionalidades integradas (Google, Mercado Pago, WhatsApp, etc) podem utilizar seus próprios cookies conforme suas respectivas políticas.</p>
          </section>

          <section>
            <h2 className="text-xl mt-8 mb-4">5. Como Gerenciar</h2>
            <p>Você pode controlar ou remover cookies nas configurações do seu navegador. A desativação de cookies essenciais pode limitar o funcionamento da plataforma.</p>
          </section>
        </>
      }
    />
  );
}
