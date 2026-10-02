# ADR-0004: Autenticação com Better Auth (sessão em cookie)

- **Status:** Proposta
- **Data:** 2026-10-01
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** todas (F2 implementa)

## Contexto

- Obrigatório: cadastro e login com e-mail e senha, com senha protegida por hash e salt.
- O `realtime` precisa saber quem está conectado no WebSocket.
- Possíveis módulos reserva: OAuth (42, GitHub) e 2FA.
- Em 2025 a manutenção do Auth.js (NextAuth) passou para o time do Better Auth, que recomenda o Better Auth para projetos novos. O Auth.js ficou em modo de manutenção.

## Decisão

- **Better Auth** no `web`, com adapter Prisma, e-mail e senha (hash scrypt com salt, feito pela biblioteca) e **sessões guardadas no banco**, identificadas por cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Rate limit de login habilitado.
- Helpers `getSession()` e `requireUser()` no `web`, como única porta de entrada para "quem é o usuário".
- **realtime:** no handshake do socket, repassa o cookie para o endpoint de sessão do `web` e guarda o `userId` no socket.
- **Serviços internos** (`trails`, `ai`): recebem `x-user-id` do `web` junto com `x-internal-token`.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Auth.js (NextAuth) | Muito conhecido | Em manutenção; o provedor de credenciais é desencorajado pela própria documentação |
| Clerk, Auth0 (SaaS) | Pronto | Dependência externa, nada de aprendizado e talvez não aceito como "nossa" gestão de usuários |
| JWT feito à mão | Aprendizado | Fácil errar (revogação, armazenamento, rotação); risco de segurança |
| Lucia | Didático | Descontinuado como biblioteca (virou material de estudo) |

## Consequências

**Positivas:** autenticação segura sem reinventar; plugins prontos para OAuth e 2FA (módulos reserva baratos); sessão revogável (logout invalida no banco).

**Negativas:** o `realtime` depende do `web` para validar a sessão (uma chamada por conexão, aceitável). A API da biblioteca muda entre versões: consulte a documentação da versão instalada.

## 💡 Para aprender

- Hash de senha: por que bcrypt, scrypt ou argon2 e não SHA-256; o que é salt.
- Sessão com estado (no banco) × token sem estado (JWT): vantagens e desvantagens.
- Atributos de cookie: `HttpOnly`, `Secure`, `SameSite`; CSRF.
- Documentação: <https://www.better-auth.com/docs>
