#!/usr/bin/env bash
# Rebuild every frozen sold-row file from its pinned public copy, then freeze it.
#   jobs/valuation/data/fetch.sh <out_dir> [source...]      (default: every source but nber_ebay_bo)
# Needs git, python3 and network to github.com; py7zr is installed for the Mercari archive.
# The freeze refuses any raw file whose sha256 differs from sources.json, so a changed mirror fails loudly.
# nber_ebay_bo is too large for a laptop run: see README.md "The NBER eBay data" for the Databricks route.
set -euo pipefail
OUT=$(realpath "${1:?out_dir}"); shift
SOURCES=("${@:-mercari_kaggle stockx_2019 grailed_2021 ebay_comps_cc0 goodwill_cc0 mercari_apify_ccby}")
HERE=$(cd "$(dirname "$0")" && pwd)
JOBS=$(cd "$HERE/../.." && pwd)
RAW="$OUT/raw"; mkdir -p "$RAW"

clone() {   # clone <repo url> <commit> <dir>: shallow, pinned, without LFS
  [ -d "$3/.git" ] || GIT_LFS_SKIP_SMUDGE=1 git clone -q --filter=blob:none --no-checkout "$1" "$3"
  git -C "$3" fetch -q --depth 1 origin "$2" && git -C "$3" checkout -q "$2"
}
freeze() { (cd "$JOBS" && PYTHONPATH=../log python3 -m valuation.data.freeze "$@"); }

for s in ${SOURCES[@]}; do
  case "$s" in
    mercari_kaggle)
      clone https://github.com/xzachx/Kaggle-Mercari 9b039f462e22f341407bec5cf691c69295d964d0 "$RAW/mercari"
      python3 -c "import py7zr" 2>/dev/null || pip install -q py7zr
      [ -f "$RAW/mercari/train.tsv" ] || python3 -c "import py7zr,sys; py7zr.SevenZipFile(sys.argv[1]).extractall(sys.argv[2])" "$RAW/mercari/input/train.tsv.7z" "$RAW/mercari"
      freeze mercari_kaggle "$OUT/mercari_kaggle" "$RAW/mercari/train.tsv" ;;
    stockx_2019)
      clone https://github.com/sealuwee/stockx-eda-2019 4be02ae9e4bdc8ebc34d90724aec859e5aef3843 "$RAW/stockx"
      freeze stockx_2019 "$OUT/stockx_2019" "$RAW/stockx/StockX-Data-Contest-2019.xlsx" ;;
    grailed_2021)
      clone https://github.com/albertfrantz/grailed_sold_data be5be58724c6edbc15d558eb1e51cd3141730574 "$RAW/grailed"
      [ -f "$RAW/grailed/grailed_sold_data.csv" ] || (cd "$RAW/grailed" && python3 -m zipfile -e grailed_sold_data.zip .)
      freeze grailed_2021 "$OUT/grailed_2021" "$RAW/grailed/grailed_sold_data.csv" ;;
    ebay_comps_cc0|goodwill_cc0)
      clone https://github.com/silentdirectivellc-hub/ebay-sold-comps 03d2186398f3f79d08bb23449e9e1382348100cc "$RAW/cc0"
      if [ "$s" = goodwill_cc0 ]; then files=("$RAW"/cc0/data/goodwill-*.csv); else files=($(ls "$RAW"/cc0/data/*.csv | grep -v /goodwill-)); fi
      freeze "$s" "$OUT/$s" "${files[@]}" ;;
    mercari_apify_ccby)
      clone https://github.com/malekoweis/resale-market-data bb14775f95331d4cf8f3e683ca1cf688a21a6de8 "$RAW/apify"
      freeze mercari_apify_ccby "$OUT/mercari_apify_ccby" "$RAW/apify/data/mercari-us-sold-listings.csv" ;;
    *) echo "unknown source: $s" >&2; exit 2 ;;
  esac
  cp "$OUT/$s/manifest.json" "$HERE/manifests/$s.json"
done
