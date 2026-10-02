# ADR-0008: Frontend com Tailwind + shadcn/ui, Leaflet e Recharts

- **Status:** Proposta
- **Data:** 2026-10-01
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** todas que têm UI

## Contexto

- O subject exige uma solução de estilo (framework CSS ou similar), frontend responsivo e acessível, e console sem erros.
- O produto depende de mapas (lista + mapa, percurso da trilha) e de um gráfico de perfil de elevação.

## Decisão

- **Tailwind CSS** + **shadcn/ui**: componentes copiados para `apps/web/components/ui`, construídos sobre Radix (acessibilidade de teclado e leitores de tela já resolvida). O Tech Lead é dono dessa pasta.
- **Formulários:** react-hook-form + zod (o mesmo schema do backend).
- **Mapas:** **Leaflet** via react-leaflet, carregado só no cliente (`dynamic(..., { ssr: false })`). Tiles **raster** com provedor configurável por variável de ambiente:
  - padrão: OpenStreetMap (respeitando a [política de uso](https://operations.osmfoundation.org/policies/tiles/): atribuição visível, sem pré-carregamento ou uso offline);
  - alternativa topográfica, boa para trilhas: OpenTopoMap;
  - se houver bloqueio ou erro (que sujaria o console), trocar o provedor pela variável.
- **Gráficos:** Recharts (perfil de elevação, gráficos simples).
- **Ícones:** lucide-react (padrão do shadcn).

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| MapLibre GL (mapas vetoriais) | Bonito, rápido, WebGL | Mais complexo (estilos, fontes, sprites); Leaflet é mais simples de aprender |
| Google Maps / Mapbox | Polidos | Chave, cobrança, termos; dados não abertos |
| MUI / Chakra | Muitos componentes prontos | Mais pesados; o estilo diverge do Tailwind |
| Chart.js | Popular | Recharts é mais natural em React |

## Consequências

**Positivas:** visual consistente rápido; acessibilidade de base pronta; Leaflet tem curva de aprendizado curta.

**Negativas:** o Leaflet exige cuidado com SSR e com StrictMode (erros no console). Tiles de terceiros podem limitar o acesso: o provedor precisa ser configurável.

## 💡 Para aprender

- Tiles raster × vetoriais; o sistema de coordenadas Web Mercator.
- Por que bibliotecas que acessam `window` quebram no SSR.
- Acessibilidade: o que o Radix resolve e o que continua sendo nossa responsabilidade (textos alternativos, contraste, foco).
- <https://react-leaflet.js.org>, <https://ui.shadcn.com>
