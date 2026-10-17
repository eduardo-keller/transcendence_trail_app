## O que muda

<!-- 2–4 linhas: o que esta PR faz e por quê. -->

Closes #

**Área / módulo(s):** <!-- ex.: Di / 4. Gerenciamento de usuários (docs/MODULOS.md) -->

## Como testar

<!-- Passos para quem revisa reproduzir: usuários, URLs, comandos. -->
1.

## Checklist

- [ ] Entradas novas validadas no front **e** no back (zod)
- [ ] Testei no Chrome com o DevTools aberto: **nenhum erro ou warning no console**
- [ ] Ações de criar, editar ou excluir chamam `notify()` e estão na [lista de notificações](../docs/MODULOS.md#ações-que-geram-notificação) (ou não se aplica)
- [ ] Autorização conferida no servidor (ou não se aplica)
- [ ] Nenhum segredo no diff; `docker/.env.example` atualizado se criei variável
- [ ] Mensagens de commit claras (nada de `wip`)

### Documentação
- [ ] Caixas da minha seção em [docs/MODULOS.md](../docs/MODULOS.md)
- [ ] [Interfaces entre pessoas](../docs/TECNICO.md#interfaces-entre-pessoas), se criei ou mudei algo que outra pessoa usa
- [ ] `README.md`: Features (com o meu nome); Instructions se mudei o setup; Database Schema se mudei uma relação
- [ ] Nada a atualizar

## Uso de IA nesta PR

<!-- Ferramenta(s), para quê, o que você revisou ou reescreveu. Alimenta a seção de IA do README. Se não usou, escreva "nenhum". -->

## Como eu explicaria isso na avaliação

<!-- Escrito POR VOCÊ. 2–5 linhas. Também serve de base para "Individual Contributions" no README. -->
