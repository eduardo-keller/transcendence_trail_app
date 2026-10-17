# Documentação

Leia nesta ordem (cerca de 15 minutos):

0. Os dois diagramas: [como a aplicação funciona](diagramas/arquitetura.png) e [quem faz o quê](diagramas/divisao.png).
1. [PLANO.md](PLANO.md): o produto, quem faz o quê, pontuação, o que está em aberto.
2. [MODULOS.md](MODULOS.md): **a sua seção**. O que o subject exige de cada módulo seu, como demonstrar, de quem você depende.
3. [TECNICO.md](TECNICO.md): arquitetura, convenções, interfaces entre pessoas, git.

Para consultar quando precisar:

| Documento | Para quê |
|---|---|
| [subject.md](subject.md) | Enunciado oficial. **Fonte da verdade** |
| [../README.md](../README.md) | README exigido pelo subject (avaliado) + como rodar o projeto |
| [AVALIACAO.md](AVALIACAO.md) | Checklist eliminatório, Privacidade e Termos, roteiro da demo |
| [decisoes/](decisoes/README.md) | Decisões técnicas tomadas e pendentes |
| [dados-trilhas.md](dados-trilhas.md) | De onde vêm as trilhas, como importar, o que falta, licenças do mapa |
| [diagramas/](diagramas/) | Os dois diagramas. Para editar: abra o `.excalidraw` em [excalidraw.com](https://excalidraw.com) (menu → Abrir), edite e exporte o PNG com o mesmo nome |
| [agente/](agente/) | Material de quem usa agentes de IA (não precisa ler) |

**Quando algo divergir:** subject > código > estes documentos. Viu um doc errado? Corrija no seu PR ou avise o dono da parte.

**Ao entregar algo, atualize no mesmo PR:** as caixas da sua seção em [MODULOS.md](MODULOS.md); a [lista de notificações](MODULOS.md#ações-que-geram-notificação), se criou uma ação; [TECNICO.md](TECNICO.md#interfaces-entre-pessoas), se criou ou mudou algo que outra pessoa usa; o [README](../README.md) (Features, e Instructions se mudou o setup).
