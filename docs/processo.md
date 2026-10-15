# Processo semanal da Bússola do Ciclo

Tudo roda sozinho no GitHub Actions (`.github/workflows/semanal.yml`), sem trabalho manual:

- **Todo dia útil, 20h (Brasília):** coleta os dados e salva no repositório.
- **Segunda, 9h:** confere, registra a previsão da semana, compara as antigas e manda o relatório por e-mail (issue do GitHub).

## De onde vêm os preços do Cepea

O site do Cepea bloqueia robôs e agentes de IA (está escrito no `robots.txt` deles), então não coletamos de lá. Os mesmos indicadores (Boi Gordo CEPEA/B3 e Bezerro MS) são republicados pelo **Notícias Agrícolas**, que permite robôs. A página mostra os últimos ~10 dias úteis; como a coleta é diária, nenhum dia se perde. Em 15/10/2026 os 10 dias em comum com a planilha oficial bateram 100%.

Toda coleta confere os dias que já estavam no histórico: se um valor divergir mais de 0,5%, vira aviso no relatório.

**Reserva automática (Scot Consultoria):** todo dia o robô também guarda o boi gordo da Scot em 24 praças (`data/raw/scot/boi-gordo.json`). É outra pesquisa, por isso não é igual ao Cepea: o robô mede a diferença normal entre os dois (mediana dos últimos 20 dias, usando SP-Barretos) e:
- avisa se a diferença de hoje fugir mais de 3% do normal;
- se o Cepea parar, estima os dias faltantes pela Scot, marcados como `estimado-scot`, e troca pelo valor real assim que ele voltar. Só liga depois de 5 dias em comum. Em teste, errou 0,3–0,4%.

**Plano B (só se o relatório avisar que a coleta parou):** baixe as planilhas no Cepea e envie em `data/manual/cepea/` com os nomes `cepea_boi_gordo.xls` e `cepea_bezerro_ms.xls` (GitHub → Add file → Upload files). O robô junta ao histórico; a planilha oficial vence quando houver diferença.

## O que o robô faz

| Etapa | Arquivo | Resultado |
|---|---|---|
| 1. Coletar (diário) | `pipeline/coletar.ts` | Cepea via Notícias Agrícolas, Banco Central (Selic, IGP-DI, dólar) e IBGE (abate por tipo) em `data/raw/` |
| 1b. Plano B | `pipeline/ler_cepea.py` | Planilhas enviadas à mão entram no histórico |
| 2. Conferir | `pipeline/semanal.ts` | Dado do Cepea com mais de 14 dias, ou dados de uma semana já passada, **bloqueiam** a previsão (nada de previsão registrada com atraso); salto diário acima de 7%, fonte que não respondeu ou dado atrasado gera **aviso para revisar** |
| 3. Prever e registrar | `pipeline/semanal.ts` | `data/previsoes/AAAA-Snn.json`: boi e bezerro em 4, 13 e 52 semanas, com faixa provável (80%), pesos do modelo e o quanto cada sinal pesou. **Nunca é sobrescrito** |
| 4. Comparar | `pipeline/semanal.ts` | `data/avaliacoes.json`: cada previsão vencida contra a média real da semana-alvo (erro, dentro da faixa, direção certa) |
| 5. Ajustar | `pipeline/modelo/previsao.ts` | O modelo é re-treinado toda semana com todos os dados; a faixa é recalibrada com previsões "às cegas" dos 10 anos anteriores. Os pesos de cada semana ficam gravados no arquivo da previsão, então dá para ver o que mudou |
| 6. Dados do app | `pipeline/painel.ts` | `data/painel.json`: tudo que o site mostra (série, fase, previsão, acerto, praças) |
| 7. Publicar | workflow | Dados salvos no repositório + issue com o relatório (o GitHub manda por e-mail) |

## O modelo

- **Fase do ciclo:** pelo preço real do boi (corrigido pelo IGP-DI). Pico ou vale só é confirmado depois que o preço anda 20% a partir dele. Mostra há quantos meses o preço sobe ou cai e compara com a duração das subidas anteriores.
- **Fêmeas no abate:** o nível (acima/abaixo da média) acertou só 28% e não decide nada. Mas a **mudança de direção** (pico confirmado quando a média de 12 meses cai 0,5 ponto) marcou uma virada por meia-onda desde 2002, sem sinal falso. Em 2006, 2013 e 2019 o pico do boi veio 50, 18 e 19 meses depois do pico de fêmeas. Uso na fase: a alta só é chamada de "fim da alta" quando o preço já sobe há mais que a menor subida anterior **e** o pico de fêmeas está confirmado há mais que o menor atraso já visto. A janela do pico no gráfico junta as duas regras.
- **Correção de 15/10/2026:** antes a fase olhava só a duração da subida do preço e chamava out/2026 de "alta madura". Ignorava que o descarte de vacas bateu recorde (47%) e só agora começou a virar. Com o relógio das vacas, out/2026 é "alta" e o pico, se o passado se repetir, fica entre dez/2027 e fev/2028. Os vereditos de compra não mudaram no teste 2006–2023 (comprar reposição no meio ou no fim da alta deu resultado parecido).
- **Previsão:** regressão linear com sinais do ciclo (fêmeas, tendência de 3 e 12 meses, preço real vs. média de 10 anos, relação de troca, época do ano). Resultado do teste em `data/backtest/relatorio.json` (refazer com `node pipeline/modelo/backtest.ts`).

## Rodar no computador

```sh
node pipeline/coletar.ts                                   # precisa de internet
uv run --no-project --with xlrd python pipeline/ler_cepea.py
node pipeline/semanal.ts
```

## O app

```sh
npm install
npm run painel   # gera data/painel.json
npm run dev      # abre em http://localhost:3000
```

- **Onda do ciclo:** preço real do boi desde 2006, picos e vales, zona histórica de pico e previsão com faixa.
- **Veredito por perfil** (Cria, Recria/Engorda, Iniciante): regras em `lib/veredito.ts`, cada uma com o motivo na tela. O simulador recalcula ao vivo.
- **Acerto do modelo:** teste no passado + comparação ao vivo semana a semana.
- **Consultor:** 5 perguntas e parecer pelas regras. Com a chave do OpenRouter do próprio usuário (guardada só no navegador dele), vira conversa livre; a chave passa por `app/api/chat` e não é gravada.
