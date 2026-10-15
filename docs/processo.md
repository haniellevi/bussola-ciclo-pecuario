# Processo semanal da Bússola do Ciclo

Tudo roda sozinho no GitHub Actions (`.github/workflows/semanal.yml`) toda segunda às 9h (Brasília) e sempre que uma planilha nova do Cepea é enviada.

## O que você faz (toda segunda, ~1 minuto)

1. Baixe as duas planilhas no site do Cepea:
   - Boi gordo: https://www.cepea.org.br/br/indicador/boi-gordo.aspx → "Série de preços"
   - Bezerro MS: https://www.cepea.org.br/br/indicador/bezerro.aspx → "Série de preços"
2. No GitHub, abra a pasta `data/manual/cepea/` → **Add file → Upload files**. Envie os arquivos com estes nomes exatos:
   `cepea_boi_gordo.xls` e `cepea_bezerro_ms.xls`. Clique em **Commit changes**.
3. O robô roda em seguida e manda o relatório por e-mail (issue do GitHub).

O Cepea bloqueia robôs, por isso essa parte é manual.

## O que o robô faz

| Etapa | Arquivo | Resultado |
|---|---|---|
| 1. Coletar | `pipeline/coletar.ts` | Banco Central (Selic, IGP-DI, dólar) e IBGE (abate por tipo) em `data/raw/` |
| 1b. Ler Cepea | `pipeline/ler_cepea.py` | Planilhas viram `data/raw/cepea/*.json` |
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
