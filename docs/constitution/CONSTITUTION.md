# Constituição Oficial do Projeto Lunari

**Versão 1.0** — documento fundador. Prevalece sobre qualquer decisão técnica. Conflito = revisar a implementação, não a constituição.

---

## 1. Filosofia do Produto
O Lunari é uma plataforma construída para simplificar a rotina do fotógrafo. Toda decisão deve priorizar: simplicidade, velocidade, previsibilidade, consistência, segurança e facilidade de uso. O usuário nunca deve precisar conhecer detalhes técnicos para utilizar o sistema.

## 2. O Produto vem antes da Tecnologia
Nenhuma decisão técnica poderá comprometer a experiência do usuário. Entre duas soluções tecnicamente válidas, escolher a de melhor experiência.

## 3. Uma única fonte da verdade
Toda regra de negócio existe apenas uma vez. Nenhuma regra poderá ser duplicada entre Interface, Assistente, API, Mobile, Integrações ou Edge Functions.

## 4. O Assistente Lunari é cidadão de primeira classe
O Assistente faz parte da plataforma. Toda funcionalidade nova deve considerar que poderá ser usada por ele.

## 5. Interface nunca contém regra de negócio
A interface apenas apresenta informações. Regras vivem fora da camada visual.

## 6. Segurança acima da automação
Nenhuma automação ignora validações existentes. O Assistente usa exatamente as mesmas validações da interface. **O Assistente nunca acessa diretamente o banco de dados, nem chama Edge Functions que não estejam registradas como Capability.**

## 7. Nunca executar ações destrutivas sem confirmação
Excluir dados, alterar informações críticas, movimentar valores, enviar cobranças, cancelar eventos ou modificar contratos exige confirmação explícita, salvo regra previamente autorizada.

## 8. Modularidade obrigatória
Cada módulo é independente. Comunicação entre módulos só pelas interfaces oficiais (eventos/capabilities), nunca por dependência direta de implementação.

## 9. Reutilização obrigatória
Toda funcionalidade é reutilizável. Nenhuma lógica existe apenas para uma tela.

## 10. Toda ação deve possuir identidade
Toda operação tem: nome único, entrada validada, saída tipada, permissões, idempotência quando aplicável, side-effects declarados, auditoria quando aplicável, documentação.

## 11. Toda consulta deve ser independente
Consultas nunca produzem efeitos colaterais.

## 12. O sistema deve evoluir sem reescritas
Novos módulos não exigem alteração dos existentes.

## 13. Compatibilidade é prioridade
Refatorações não quebram funcionalidades. Camadas de compatibilidade durante migrações.

## 14. Performance faz parte da experiência
Menor número de consultas, menor processamento, menor tempo de resposta, menor consumo.

## 15. Escalabilidade é obrigatória
Toda funcionalidade deve continuar válida para milhares de usuários.

## 16. Documentação faz parte do código
Nenhum módulo é concluído sem documentação atualizada (regras, capabilities, eventos).

## 17. O código deve ser compreensível
Clareza prevalece sobre soluções excessivamente complexas.

## 18. Consistência acima de criatividade
Um padrão definido é seguido por todo o sistema. Exceções são raras e tecnicamente justificadas.

## 19. O fotógrafo é o centro de todas as decisões
Toda funcionalidade responde a: "Isso economiza tempo para o fotógrafo?" Se não, reavaliar.

## 20. O Lunari é uma plataforma viva
Arquitetura permite evolução contínua. Esta constituição deve ser consultada antes de qualquer implementação.
