

# Fix: Adicionar `@react-three/fiber` ao package.json

## Diagnóstico

Todas as mudanças visuais (CSS variables, glass class, Card glassmorphism, Header blur, InternalBackground, DashboardBackground) já foram implementadas corretamente. O build falha porque `@react-three/fiber` não foi adicionado ao `package.json` — apenas `three` e `@types/three` estão presentes.

## Correção

### `package.json`
Adicionar `@react-three/fiber` versão `^8.18.0` às dependencies.

É uma única linha que resolve o build. Após isso, todas as mudanças visuais (glassmorphism nos cards, fundo 3D orbital no dashboard, blobs animados nas páginas internas) ficarão visíveis.

