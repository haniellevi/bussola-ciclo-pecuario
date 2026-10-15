"""Converte as planilhas baixadas do Cepea (data/manual/cepea) em JSON (data/raw/cepea).

O Cepea bloqueia coleta automática; as planilhas são baixadas à mão toda semana.
Os arquivos vêm com cabeçalho corrompido, por isso ignore_workbook_corruption.
Uso: uv run --no-project --with xlrd python pipeline/ler_cepea.py
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import xlrd

RAIZ = Path(__file__).resolve().parent.parent / "data"

PLANILHAS = {
    "cepea_boi_gordo.xls": ("boi-gordo.json", "R$/arroba"),
    "cepea_bezerro_ms.xls": ("bezerro-ms.json", "R$/cabeça"),
}


def ler(arquivo: Path) -> tuple[str, list[dict]]:
    aba = xlrd.open_workbook(arquivo, ignore_workbook_corruption=True).sheet_by_index(0)
    titulo = aba.cell_value(0, 0)
    cabecalho = aba.row_values(3)
    if cabecalho[:2] != ["Data", "À vista R$"]:
        raise ValueError(f"{arquivo.name}: cabeçalho mudou: {cabecalho}")
    pontos = []
    for i in range(4, aba.nrows):
        data, reais, dolares = aba.row_values(i)[:3]
        if not data or reais in ("", None):
            continue
        d, m, a = str(data).split("/")
        pontos.append({"data": f"{a}-{m}-{d}", "valor": float(reais), "usd": float(dolares or 0) or None})
    pontos.sort(key=lambda p: p["data"])
    return titulo, pontos


def main() -> None:
    for origem, (destino, unidade) in PLANILHAS.items():
        caminho = RAIZ / "manual" / "cepea" / origem
        titulo, pontos = ler(caminho)
        saida = RAIZ / "raw" / "cepea" / destino
        saida.parent.mkdir(parents=True, exist_ok=True)
        corpo = {
            "fonte": f"{titulo} (Cepea/Esalq-USP, licença CC BY-NC 4.0)",
            "url": "https://www.cepea.org.br",
            "unidade": unidade,
            "coletadoEm": datetime.now(timezone.utc).isoformat(),
            "dados": pontos,
        }
        saida.write_text(json.dumps(corpo, ensure_ascii=False, indent=1) + "\n")
        print(f"ok {saida.relative_to(RAIZ)}: {len(pontos)} dias, {pontos[0]['data']} a {pontos[-1]['data']}")


if __name__ == "__main__":
    main()
