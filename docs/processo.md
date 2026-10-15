# Processo semanal da Bússola do Ciclo

Tudo roda sozinho no GitHub Actions (`.github/workflows/semanal.yml`), sem trabalho manual:

- **Todo dia útil, 20h (Brasília):** coleta os dados e salva no repositório.
- **Segunda, 9h:** confere, registra a previsão da semana, compara as antigas e manda o relatório por e-mail (issue do GitHub).

## De onde vêm os preços do Cepea

O site do Cepea bloqueia robôs e agentes de IA (está escrito no `robots.txt` deles), então não coletamos de lá. Os mesmos indicadores (Boi Gordo CEPEA/B3 e Bezerro MS) são republicados pelo **Notícias Agrícolas**, que permite robôs. A página mostra os últimos ~10 dias úteis; como a coleta é diária, nenhum dia se perde. Em 15/10/2026 os 10 dias em comum com a planilha oficial bateram 100%.

Toda coleta confere os dias que já estavam no histórico: se um valor divergir mais de 0,5%, vira aviso no relatório.

**Plano B (só se o relatório avisar que a coleta parou):** baixe as planilhas no Cepea e envie em `data/manual/cepea/` com os nomes `cepea_boi_gordo.xls` e `cepea_bezerro_ms.xls` (GitHub → Add file → Upload files). O robô junta ao histórico; a planilha oficial vence quando houver diferença.

## O que o robô faz

| Etapa | Arquivo | Resultado |
|---|---|---|
| 1. Coletar (diário) | `pipeline/coletar.ts` | Cepea via Notícias Agrícolas, Banco Central (Selic, IGP-DI, dólar) e IBGE (abate por tipo) em `data/raw/` |
| 1b. Plano B | `pipeline/ler_cepea.py` | Planilhas enviadas à mão entram no histórico |
| 2. Conferir | `pipeline/semanal.ts` | Dado do Cepea com mais de 14 dias **bloqueia** a previsão; salto diário acima de 7%, fonte que não respondeu ou dado atrasado gera **aviso para revisar** |
| 3. Prever e registrar | `pipeline/semanal.ts` | `data/previsoes/AAAA-Snn.json`: boi e bezerro em 4, 13 e 52 semanas, com faixa provável (80%), pesos do modelo e o quanto cada sinal pesou. **Nunca é sobrescrito** |
| 4. Comparar | `pipeline/semanal.ts` | `data/avaliacoes.json`: cada previsão vencida contra a média real da semana-alvo (erro, dentro da faixa, direção certa) |
| 5. Ajustar | `pipeline/modelo/previsao.ts` | O modelo é re-treinado toda semana com todos os dados; a faixa é recalibrada com previsões "às cegas" dos 10 anos anteriores. Os pesos de cada semana ficam gravados no arquivo da previsão, então dá para ver o que mudou |
| 6. Publicar | workflow | Dados salvos no repositório + issue com o relatório (o GitHub manda por e-mail) |

## O modelo

- **Fase do ciclo:** pelo preço real do boi (corrigido pelo IGP-DI). Pico ou vale só é confirmado depois que o preço anda 20% a partir dele. Mostra há quantos meses o preço sobe ou cai e compara com a duração das subidas anteriores.
- **Fêmeas no abate:** só contexto. No teste (treino até 2022, teste 2023–2026) a regra de fase pelas fêmeas acertou 28%, então não decide nada.
- **Previsão:** regressão linear com sinais do ciclo (fêmeas, tendência de 3 e 12 meses, preço real vs. média de 10 anos, relação de troca, época do ano). Resultado do teste em `data/backtest/relatorio.json` (refazer com `node pipeline/modelo/backtest.ts`).

## Rodar no computador

```sh
node pipeline/coletar.ts                                   # precisa de internet
uv run --no-project --with xlrd python pipeline/ler_cepea.py
node pipeline/semanal.ts
```
