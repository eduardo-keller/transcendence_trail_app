# Provedor de LLM e embeddings

> Última atualização: 2026-11-02. Dono: Edu.
> Status: **decidido** — Google Gemini pelo Vercel AI SDK 7.

## Contexto

- Dois módulos Major dependem disso: **Interface de LLM** (streaming, erros, rate limit) e **RAG**.
- O RAG precisa de embeddings para indexar o corpus e as perguntas.
- Orçamento de estudante: o desenvolvimento não pode gastar dinheiro, e a chave precisa funcionar no dia da avaliação.

## Decisão

| O quê | Escolha | Por quê |
|---|---|---|
| Provedor | **Google Gemini** (`gemini-3.5-flash-lite` por padrão; trocável em `LLM_MODEL`) | Camada gratuita; geração e embeddings na mesma API |
| Embeddings | `gemini-embedding-001`, 768 dimensões, pela API | Os embeddings locais não rodam na imagem Alpine (o `onnxruntime` exige glibc) e somariam ~700 MB |
| Biblioteca | **Vercel AI SDK 7** (`ai`, `@ai-sdk/google`, `@ai-sdk/react`), versões fixas | Streaming até o navegador, botão de parar e modelo falso prontos; busca, prompts e rate limit continuam no nosso código |
| Dev e testes | `LLM_PROVIDER=mock`: texto fixo em streaming, sem chave e sem cota | Desenvolver e testar sem gastar |
| Vetores | No banco principal (pgvector), consultados com `$queryRaw` | Sem outro banco |
| Rate limit | Por usuário (por minuto e por dia), no app | Protege a cota gratuita |

O código fica em `apps/web/src/server/ai/`; `model.ts` é o único arquivo que conhece o provedor.

## Consequências

- **Chave:** `docker/secrets/gemini_api_key.txt` (o `make` cria vazio). Vazio = assistente desligado, com aviso; o resto do app funciona.
- **Privacidade:** na camada gratuita, o Google usa o conteúdo enviado para melhorar os produtos dele. A Política de Privacidade precisa dizer isso, e o app não envia nome nem e-mail.
- **Cota:** os limites são por projeto do Google, e o diário zera à meia-noite do Pacífico. Os números do seu projeto aparecem só no AI Studio. Para o dia da avaliação, ter uma chave reserva de **outro projeto**.
- **Teste da ligação:** `docker compose -f docker/docker-compose.yml exec nextjs node scripts/ai-smoke.mts` (gasta 4 pedidos).
