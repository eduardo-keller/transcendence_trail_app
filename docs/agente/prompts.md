# Prompts prontos

> Para o Edu. Copie, cole e ajuste.

**Resumo de status (para mandar ao time)**
```
Leia docs/PLANO.md e docs/MODULOS.md e o git log da última semana. Monte um resumo curto,
em pt-BR, para mandar no canal do time: por pessoa, o que entrou (commits), quantas caixas
📜 de cada módulo estão marcadas, o que está bloqueando alguém e os itens "em aberto" do PLANO.
Sem julgamentos sobre pessoas; só fatos. Máximo de 20 linhas.
```

**Auditoria docs × código**
```
Compare docs/TECNICO.md, docs/MODULOS.md (seções "Já existe" e caixas marcadas), docs/decisoes/README.md
e o README.md com o código atual da main. Liste as divergências numa tabela (doc, o que diz,
o que o código faz, arquivo, sugestão). Não corrija nada ainda.
```

**Começar uma tarefa minha**
```
Vou trabalhar em <tarefa> do módulo <N> (docs/MODULOS.md). Verifique o estado atual do código
e o git log da área. Se não for trivial, proponha um plano com docs/agente/planos/TEMPLATE.md.
Não escreva código antes da minha aprovação. Aponte o que depende de outra pessoa
(docs/TECNICO.md#interfaces-entre-pessoas).
```

**Revisar o PR de um colega**
```
Revise o PR #<N>. Considere: as caixas 📜 do módulo em docs/MODULOS.md; validação no front e no back;
autorização no servidor; notificações das ações de criar, editar ou excluir; possíveis erros
de console; segredos no diff; mensagens de commit. Ordene por gravidade e escreva os comentários
num tom que eu possa colar no GitHub.
```

**Conferir notificações**
```
Liste todas as Server Actions e Route Handlers que criam, editam ou excluem dados.
Para cada um, diga se chama notify() e se a ação está na lista "Ações que geram notificação"
de docs/MODULOS.md. Mostre só as que faltam.
```

**Preparar a minha explicação**
```
Explique <arquivo ou fluxo> como se eu fosse apresentar ao avaliador da 42: o que faz, por que
foi feito assim, que alternativas existiam. Depois me faça 3 perguntas para checar se entendi,
e não dê as respostas até eu tentar.
```

**Simular a modificação ao vivo**
```
Aja como avaliador da 42. Peça uma modificação pequena (5–10 min) no módulo <módulo>,
como as do subject (mudar um comportamento, adicionar um campo, ajustar uma tela).
Não me ajude a implementar. Quando eu terminar, avalie o que fiz.
```
