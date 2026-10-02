# ADR-0009: Arquivos em volume local com acesso autenticado

- **Status:** Proposta
- **Data:** 2026-10-01
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** F2 (implementa), F4 (GPX), F1 (volume e backup)

## Contexto

- O módulo de upload exige vários tipos de arquivo, validação, **armazenamento seguro com controle de acesso**, preview, progresso e exclusão.
- O caminho "padrão de mercado" seria um object storage compatível com S3. O MinIO, opção comum para rodar localmente, deixou de publicar imagens Docker da edição comunitária em 2025 e o projeto open source entrou em modo de manutenção.

## Decisão

- Arquivos num **volume Docker** (`uploads`) montado só no `web`, **fora** de qualquer pasta servida estaticamente.
- Nome no disco: UUID aleatório (nunca o nome enviado pelo usuário, o que evita path traversal e colisões). Metadados no banco (`File`: dono, tipo, MIME, tamanho, nome original, contexto e visibilidade).
- **Download só por rota autenticada** (`GET /api/files/:id`), que verifica a permissão (dono, arquivo público como avatar, ou membro da comunidade) e responde com `Content-Type` correto, `Content-Disposition` e `X-Content-Type-Options: nosniff`.
- **Validação no servidor** pelo conteúdo (magic bytes), não pela extensão; limites de tamanho por tipo; imagens reprocessadas (remove EXIF com GPS e gera miniatura); GPX validado como XML GPX.
- **Progresso:** upload via `XMLHttpRequest` (`upload.onprogress`), já que o `fetch` não informa progresso de envio.
- O volume entra nos **backups** (F1).

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| MinIO (S3 local) | API S3, URLs pré-assinadas | Imagens descontinuadas; precisaríamos compilar e manter |
| Outros S3 locais (Garage, SeaweedFS) | API S3 | Mais um sistema para aprender e operar |
| Armazenar no Postgres (bytea) | Backup único | Infla o banco e piora o desempenho |
| Pasta `public/` do Next.js | Trivial | **Sem controle de acesso**: reprova o requisito |

## Consequências

**Positivas:** simples, seguro e com controle de acesso explícito no código (fácil de demonstrar e explicar).

**Negativas:** não escala horizontalmente (um só `web` acessa o volume), o que é irrelevante para o projeto. Se quiser evoluir, isole o acesso a disco atrás de uma interface `FileStorage`, que permite trocar por S3 depois.

## 💡 Para aprender

- `multipart/form-data`; por que validar pelo conteúdo e não pela extensão.
- Path traversal; `Content-Type` sniffing.
- Metadados EXIF e privacidade.
- Object storage × sistema de arquivos.
