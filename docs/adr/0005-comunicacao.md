# ADR-0005: REST interno + Redis pub/sub + Socket.IO

- **Status:** Proposta
- **Data:** 2026-10-01
- **Decisores:** time (aceitar no kickoff)
- **Frentes afetadas:** todas

## Contexto

- O módulo de microsserviços pede "REST APIs ou filas de mensagens".
- O tempo real pede atualização entre clientes, reconexão e broadcast eficiente.
- Notificações precisam ser disparadas por ações em vários lugares sem acoplar os produtores ao serviço de notificação.

## Decisão

1. **REST interno (síncrono)** entre serviços, JSON, autenticado por `x-internal-token`. Para quando quem chama **precisa da resposta** (ex.: buscar trilhas).
2. **Redis pub/sub (assíncrono)** para eventos de domínio com envelope padrão. Para quando quem produz está **avisando que algo aconteceu** (ex.: `notification.requested`).
3. **Socket.IO** entre navegador e `realtime`: salas por usuário e por comunidade, ack, reconexão automática.
4. **SSE** (Server-Sent Events) para streaming de respostas de IA (`ai` → `web` → navegador).
5. O Redis também guarda contadores de rate limit e o conjunto de usuários online.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| RabbitMQ, Kafka | Filas "de verdade", com persistência e roteamento | Mais um sistema complexo para operar; exagero para o volume |
| Redis Streams / BullMQ | Entrega garantida (pelo menos uma vez), retry | Mais conceitos (consumer groups, ack); **caminho de evolução** se a perda de eventos virar problema |
| `ws` puro | Mais leve; aprende o protocolo cru | Sem salas, reconexão nem ack; mais código nosso |
| SSE para tudo | Simples, só HTTP | Unidirecional; o chat precisa de duas vias |
| gRPC | Contratos fortes e rápidos | Curva de aprendizado; ferramentas de debug menos simples |

## Consequências

**Positivas:** produtores desacoplados de consumidores; o Redis faz três papéis com um container só; o Socket.IO resolve reconexão e salas.

**Negativas:** o pub/sub entrega **no máximo uma vez**: se o `realtime` estiver reiniciando, os eventos daquele instante se perdem. Mitigação: o dado importante está no banco, e o cliente ressincroniza ao reconectar (`sync:since`).

## 💡 Para aprender

- Síncrono × assíncrono; acoplamento temporal.
- Pub/sub × fila de trabalho; garantias "no máximo uma vez", "pelo menos uma vez" e "exatamente uma vez".
- WebSocket: handshake HTTP → upgrade; por que precisa de configuração especial no proxy.
- Socket.IO: rooms, acknowledgements, reconexão. <https://socket.io/docs/v4/>
