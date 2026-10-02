# Pontos críticos e riscos

> Última atualização: 2026-10-01 — avaliação inicial.
> Donos: PM (acompanhamento) + Tech Lead (riscos técnicos). Revisar na reunião semanal: algum risco mudou? Surgiu algum novo?

Escala: **P** = probabilidade, **I** = impacto (A alto, M médio, B baixo).

## 1. Os 6 pontos mais críticos

Os riscos que mais podem custar nota ou tempo, em ordem:

1. **Console do navegador com erros ou warnings** (R1): reprova o projeto inteiro, e as causas são muitas e silenciosas.
2. **Microsserviços questionado pelo avaliador** (R2): 2 pontos dependem de interpretação.
3. **Notificações "para todas as ações"** (R7): muito fácil esquecer uma ação.
4. **Catálogo de trilhas pequeno ou de baixa qualidade** (R3): o produto parece vazio.
5. **Dependências externas no dia da avaliação** (R5): Overpass, tiles e API de LLM.
6. **Membros que não conseguem explicar código gerado por IA** (R12): a avaliação exige explicação e modificação ao vivo.

## 2. Tabela de riscos

| ID | Risco | P | I | Mitigação | Dono |
|---|---|---|---|---|---|
| R1 | Erros ou warnings no console do Chrome | A | A | Teste Playwright que falha com qualquer erro de console; item no checklist de PR; Leaflet só no cliente; socket só conecta logado; nenhum fetch "esperado" com 401/404 | Tech Lead |
| R2 | Avaliador não aceita a arquitetura como microsserviços | M | A | ADR-0001; banco e usuário de banco por serviço; contratos documentados; demo de isolamento de falha; margem de 7 pts | F1 |
| R3 | Cobertura do OSM pequena (só 10 relações de trilha na região) | A | M | Montar trilhas agrupando vias nomeadas; retângulo configurável; POIs; não fingir cobertura (ver [pesquisa](research/osm-trilhas.md)) | F4 |
| R4 | Desnível impreciso (DEM de 90 m) | A | B | Suavização + limiar; exibir "estimado"; validar 5 trilhas conhecidas manualmente | F4 |
| R5 | Serviços externos instáveis na avaliação (Overpass com 504, tiles, Open-Meteo, LLM) | M | A | Dados do OSM e elevação **pré-processados e versionados** (nada em runtime); provedor de tiles alternativo configurável; chave de LLM com saldo; status page mostra "degradado" | F4, F5 |
| R6 | Custo ou cota do LLM estoura | M | M | Rate limit por usuário e teto global diário; `mock` em dev e CI; modelo mais barato em dev (decisão do time); métrica de tokens no Grafana | F5 |
| R7 | Notificações não cobrem todas as ações CRUD | A | M | Matriz de notificações desde o dia 1; helper `publishEvent()`; checklist de PR; conferência item a item na fase 3 | F3 |
| R8 | Auth atrasa e bloqueia todo mundo | M | A | F2 prioriza `requireUser()` no dia 1–3; seed de usuários; o PM acompanha na daily | F2 |
| R9 | WebSocket atrás de nginx com HTTPS e auth no handshake | M | M | Faz parte do critério do M0; config de upgrade no nginx; teste com o cookie real | F1, F3 |
| R10 | Conflitos de schema e migrations Prisma entre 5 pessoas | A | M | Banco por serviço; schema em vários arquivos; uma migration por PR; procedimento de rebase em [CONTRIBUTING.md](../CONTRIBUTING.md#migrations-do-prisma) | Tech Lead |
| R11 | Build Docker do monorepo e "comando único" quebrando | M | A | F1 resolve no M0; CI constrói as imagens; teste semanal em máquina limpa | F1 |
| R12 | Membro não consegue explicar código gerado por IA | M | A | Seção "O que aprendi" na PR (escrita pela pessoa); aula relâmpago semanal; rodízio nos ensaios; partes centrais escritas por humanos | PM |
| R13 | Documentação defasada | A | M | Docs curtos; checklist de PR; auditoria semanal com prompt pronto; seção "Divergências" | PM |
| R14 | RAG e LLM vistos como o mesmo módulo, ou dataset "pequeno" | M | A | Duas funcionalidades, telas e endpoints distintos; ≥ 2.000 trechos com contagem visível; justificativa no README | F5 |
| R15 | Escopo cresce (gamificação, extras) e atrasa o núcleo | M | M | MoSCoW em [PRODUCT.md](PRODUCT.md#4-escopo-priorizado-moscow); feature freeze no M2; reservas só depois do M2 | PO |
| R16 | Porta HTTP exposta ou serviço sem TLS | B | A | Só o nginx publica portas; 80 → 443; checklist de segurança | F1 |
| R17 | Vazamento de privacidade (EXIF com GPS, GPX, comunidade privada) | M | A | Reencodar imagens; GPX privado por padrão; checagem de permissão em toda leitura; testes de autorização | F2 |
| R18 | Race conditions com vários usuários (requisito obrigatório) | M | A | `UNIQUE` + transações + idempotência; teste com 3+ navegadores | Todos |
| R19 | Máquinas sem recursos (~15 containers; WSL2; máquinas da 42) | M | M | Limites de memória; observabilidade em profile opcional no dev; medir RAM no M0 | F1 |
| R20 | Histórico do git sem commits de alguém, ou squash total na entrega | B | A | Todos commitam desde a semana 1; push do histórico **completo** para o repositório da 42 | PM |
| R21 | Mudanças de API nas libs (Next.js 16, Prisma 7, Better Auth) confundem pessoas e agentes | M | M | Fixar versões; consultar a doc da versão instalada (AGENTS.md §11) | Tech Lead |

## 3. Detalhes dos riscos principais

### R1: Console limpo
Causas comuns neste stack:
- **Hydration mismatch:** datas formatadas no servidor e no cliente com fuso diferente, `Math.random()`, extensões do navegador. Formate datas no cliente ou de forma determinística.
- **Leaflet com SSR:** `window is not defined`, "Map container is already initialized" (React StrictMode em dev). Use `dynamic(..., { ssr: false })` e limpe o mapa no unmount.
- **Tiles com erro 403/429:** o provedor bloqueia ou limita. Use User-Agent/Referer corretos e tenha um provedor alternativo.
- **Requisições "esperadas" com erro:** buscar a sessão e receber 401, imagem 404 do avatar padrão, socket conectando sem login. O fluxo normal não pode gerar requisição com erro.
- **Warnings do React:** `key` faltando, `act()`, props inválidas no DOM.
- **Favicon e manifest ausentes** (404).

Mitigação automática: um teste Playwright que navega por todas as páginas (logado e deslogado) e falha com qualquer `console.error`/`console.warn` ou requisição com falha.

### R2: Defesa da arquitetura de microsserviços
Prepare para a avaliação: diagrama, tabela de responsabilidades, por que cada fronteira existe, um banco por serviço, contratos, comunicação síncrona e assíncrona, demo de falha isolada. Saiba responder: "por que o `web` faz tanta coisa?" O `web` é o BFF e o domínio principal; separar identidade, comunidades e arquivos em mais serviços aumentaria a complexidade sem benefício real para este projeto. A divisão segue fronteiras técnicas (processo de longa duração, processamento geoespacial, custo e dependências de IA). Ver [ADR-0001](adr/0001-arquitetura-servicos.md).

### R3: Dados de trilhas
Resultado da pesquisa de 2026-10-01: só 10 relações `route=hiking` na região, mas 64 grupos de vias nomeadas com 1 km ou mais. O plano completo está em [research/osm-trilhas.md](research/osm-trilhas.md). Seja honesto no produto: "trilhas mapeadas no OpenStreetMap", com um link para contribuir com o OSM.

### R12: Entender o que a IA escreveu
O subject avisa que haverá **modificação ao vivo** do código durante a avaliação. Código que "funciona mas ninguém entende" é um risco direto. Práticas em [PROCESS.md](PROCESS.md#uso-de-ia-pelos-humanos) e [LEARNING.md](LEARNING.md).
