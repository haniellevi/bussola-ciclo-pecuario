# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CicloPecuario — Bússola do Ciclo Pecuário

App gratuito (Next.js + TypeScript + Tailwind + Framer Motion) que lê o ciclo pecuário de corte no Brasil e dá veredito de compra por perfil. Repo público: haniellevi/bussola-ciclo-pecuario.

## Regras
- Falar com o usuário em português do Brasil, simples, sem jargão (usuário não é técnico).
- Todo número vem de fonte real, com data e fonte registradas. Nada de valor inventado ou fase do ciclo fixa no código.
- Previsões são registradas antes de serem comparadas e nunca editadas depois.
- Cepea é CC BY-NC 4.0: citar fonte; app não pode ser comercial sem licença.
- Nunca commitar chaves (repo público). Chaves só em `.env.local` ou GitHub Secrets.
- IA só via OpenRouter; IDs dos modelos (Jev para notícias, Luna 6 para o chat) vêm de variáveis de ambiente.
- Não instalar dependência nova sem necessidade.
- Rodar o app e testar antes de dizer que está pronto.

## Comandos
- `npm run dev` / `npm run build`: app Next.js.
- `node pipeline/<arquivo>.ts`: scripts do robô rodam direto no Node 24 (sem tsx). `npm run painel` regenera `data/painel.json`.
- `npm run verificar`: tipos (tsc) + teste da conta de margem, rápido. `npm run verificar:completo` inclui o build. Não há lint. Depois de verificar, abra o app para testar de verdade.

## Dados e robô
- `.github/workflows/semanal.yml` coleta todo dia útil e prevê às segundas; o robô commita em `data/`. Faça `git pull` antes de mexer em `data/`.
- `data/previsoes/AAAA-Snn.json` é imutável: nunca editar nem sobrescrever.
- `data/painel.json` é gerado (`npm run painel`); não editar à mão. O site lê só ele.
- Cepea bloqueia robôs: preços vêm do Notícias Agrícolas (ver `docs/processo.md`). Não coletar direto do site do Cepea.

## Ambiente
- `.env.local` (modelo em `.env.example`): `OPENROUTER_API_KEY`, `MODELO_AGENTE`, `MODELO_NOTICIAS`, `CHAT_LIMITE_HORA`.
