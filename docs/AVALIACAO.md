# Avaliação

> Última atualização: 2026-10-17 — módulos novos.
> Se a parte obrigatória falhar, o projeto é **reprovado**. Módulo que não funciona vale **0**.

## Parte obrigatória (eliminatória)

| ✔ | Requisito do subject | Como verificar | Quem |
|---|---|---|---|
| [ ] | Web app com frontend, backend e banco | Diagrama em [TECNICO.md](TECNICO.md) | Gabs |
| [ ] | Git com commits de **todos**, mensagens claras, trabalho distribuído | `git shortlog -sne`; histórico completo no repositório de entrega | Todos |
| [ ] | Containerização com **um único comando** | Clone limpo → `make` | Gabs |
| [ ] | Compatível com a última versão estável do Chrome | Roteiro completo no Chrome atualizado | Todos |
| [ ] | **Nenhum warning ou erro no console** | Navegar por todas as páginas, logado e deslogado, com o DevTools aberto | Todos |
| [ ] | Privacidade e Termos **acessíveis** (rodapé) e com **conteúdo relevante** | `/privacidade` e `/termos` ([conteúdo mínimo](#privacidade-e-termos)) | *em aberto* |
| [ ] | Vários usuários ao mesmo tempo, sem conflito | 3 navegadores agindo juntos (chat, amizade cruzada, atividades) | Rafa |
| [ ] | Atualizações em tempo real para todos os conectados, quando fizer sentido | Chat, status online, notificações | Rafa |
| [x] | Sem corrupção de dados nem race conditions | `UNIQUE`, transações (saber explicar) | Gabs |
| [ ] | Frontend claro, responsivo e acessível | Celular (DevTools), teclado, contraste | Juh |
| [ ] | Framework CSS ou solução de estilo | Tailwind | Juh |
| [ ] | Credenciais em `.env` fora do git + `.env.example` | `git ls-files \| grep -E "\.env\|secrets"` mostra só `docker/.env.example` e `docker/secrets/.gitkeep` | Gabs |
| [ ] | Schema do banco claro, com relações bem definidas | `schema.prisma` + diagrama no README | Gabs |
| [ ] | Cadastro e login com e-mail e senha seguros (hash com salt) | Configuração do Better Auth; hash em `Account.password` | Di |
| [ ] | **Todos** os formulários validados no front **e** no back | Enviar dado inválido por `curl`, sem passar pelo front | Todos |
| [x] | **HTTPS em todo o backend** | Só o nginx expõe porta; HTTP redireciona | Gabs |
| [ ] | README com todas as seções exigidas | [Checklist](#readme) | Edu (coordena) |

## Privacidade e Termos

Podem ser escritas no fim, quando as funcionalidades estiverem definidas. O link no rodapé entra antes, junto com o layout.

**Política de Privacidade:** dados coletados (nome, e-mail, avatar, perfil, amigos, mensagens, atividades e seus percursos, XP e emblemas, perguntas ao assistente); para quê; base legal (LGPD/GDPR); onde ficam armazenados; cookies (só o de sessão); cache offline do PWA no aparelho; **dados enviados a terceiros** (perguntas ao provedor de LLM, login via OAuth, tiles do mapa); quem vê o quê; direitos do titular (acesso, exportação, correção, exclusão) e **como exercê-los na página de dados**; e-mails de confirmação; contato.

**Termos de Uso:** quem pode usar; regras de conduta (chat, conteúdo); **aviso de segurança** (dados de trilha podem estar imprecisos, a atividade envolve risco e a responsabilidade é do usuário); **IA** (respostas podem conter erros); atribuições e licenças (OpenStreetMap/ODbL, Wikipedia/CC BY-SA, dados de elevação se usados); limitação de responsabilidade; encerramento de conta; projeto acadêmico da 42.

## README

- [ ] Primeira linha em itálico: *This project has been created as part of the 42 curriculum by login1, login2, …*
- [ ] Description: nome, objetivo, visão geral, funcionalidades principais
- [ ] Instructions: pré-requisitos com versões, `.env`, passo a passo
- [ ] Resources: referências e **como a IA foi usada** (tarefas e partes do projeto)
- [ ] Team Information: papéis (PO, PM, Tech Lead, Devs) e responsabilidades
- [ ] Project Management: organização, ferramentas, canais de comunicação
- [ ] Technical Stack: front, back, banco e por quê, outras libs, justificativas ([decisoes/](decisoes/README.md))
- [ ] Database Schema: diagrama, tabelas, relações, campos principais
- [ ] Features List: funcionalidades, **quem fez**, descrição
- [ ] Modules: lista, pontos, justificativa, como foi implementado, quem fez
- [ ] Individual Contributions: por pessoa, com desafios e como foram superados, **escrito pela própria pessoa**

## Roteiro da demonstração

Uma história que passa por todos os módulos. Cada dono apresenta o próprio bloco, mas todo mundo deve saber explicar o projeto inteiro.

| # | Bloco | Módulos | Quem |
|---|---|---|---|
| 1 | Clone limpo → `make` → importar `docker/nginx/certs/ca.crt` no Chrome → HTTPS → rodapé com Privacidade e Termos | Obrigatório | Gabs |
| 2 | Página `/design`: paleta, tipografia, ícones, componentes; app no celular | Design system, Frontend | Juh |
| 3 | Cadastro com erro de validação (front e back) → login → 2FA → login com OAuth | Usuários, 2FA, OAuth | Di |
| 4 | Perfil: editar, avatar, avatar padrão | Ger. de usuários | Di |
| 5 | Catálogo: lista, mapa, página da trilha, registrar atividade → notificação + XP | Catálogo, Notificações, Gamificação | dono do catálogo, Edu |
| 6 | Segundo usuário: amizade, status online, chat ao vivo, queda e volta do socket | Interação, Tempo real | Rafa |
| 7 | Assistente: perguntar (RAG, fontes) e planejar (streaming, parar, rate limit) | RAG, LLM | Edu |
| 8 | Instalar o PWA → modo offline → trilha já vista abre | PWA | Juh |
| 9 | Dados: baixar meus dados → e-mail → excluir conta com confirmação | GDPR | Di |
| 10 | *(opcionais)* Dashboard com filtros e exportação; importação em lote | Dashboard, Export/Import | Gabs |
| 11 | Código: `schema.prisma`, uma Server Action, um Route Handler | ORM, Backend | Gabs |

## Perguntas prováveis

- Como os papéis foram distribuídos? O que cada um fez? Como se comunicaram? Mostre um commit seu.
- Como a senha é guardada? Por que não SHA-256 puro?
- O que acontece se dois usuários se pedirem amizade ao mesmo tempo?
- Como a mensagem chega ao outro usuário? E se ele estiver offline?
- Como vocês garantem que todas as ações geram notificação?
- O que o service worker guarda? O que acontece offline?
- O que é um embedding? Qual a diferença entre o módulo de LLM e o de RAG?
- O que o GDPR exige? O que a exclusão de conta apaga?
- Como funciona o TOTP do 2FA? E o fluxo do OAuth?

**Modificação ao vivo** (o subject avisa que pode acontecer): editar e rodar `make` (1–2 min), que é o app como é entregue. Mudança no schema: `make dev`, `make migrate name=...`, depois `make`. Para treinar: adicionar um campo ao perfil (schema → migration → formulário → validação); mudar o rate limit do assistente; criar uma notificação para uma ação nova; mudar uma cor do design system; criar um emblema novo.

## No dia

- [ ] Máquina testada na véspera, a partir de um clone limpo do repositório de entrega.
- [ ] `docker/.env`, segredos e chaves (LLM com saldo, OAuth) prontos fora do repo; uma chave reserva.
- [ ] Contas de demonstração + saber criar uma nova na hora.
- [ ] App autenticador no celular para o 2FA.
- [ ] Dois navegadores (normal e anônimo).
- [ ] Sem internet, só os tiles do mapa, o LLM e o OAuth falham. Saber explicar isso.
