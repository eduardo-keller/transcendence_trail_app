# Como o Trilhas SP estima os dados das trilhas

O catálogo do app vem do OpenStreetMap (OSM), um mapa colaborativo. Os dados de cada trilha são estimativas e podem ter erros:

- Distância: medida sobre o traçado do OSM. Trilhas montadas com vários trechos podem não corresponder ao percurso que as pessoas fazem de fato.
- Circular ou só de ida: uma trilha "só de ida" termina em outro ponto; voltando pelo mesmo caminho, a distância dobra.
- Desnível: estimado a partir de um modelo de elevação do terreno, não medido no local. Um desnível 0 quase sempre significa falta de dado, e não trilha plana.
- Tempo: estimado a partir da distância e do desnível, para uma pessoa em ritmo médio e sem pausas.
- Dificuldade: estimada a partir da distância e do desnível; quando o OSM traz a escala SAC, ela é usada.
- Região: as descrições usadas pelo assistente dizem "na região de" porque a região foi calculada pela coordenada do início da trilha, de forma aproximada.

O app não tem informações sobre condições atuais da trilha, água no caminho, estrutura, segurança, horário de funcionamento ou cobrança de entrada. Confira essas informações com a administração do parque antes de ir.
