# gsearch pdftotext — PDF text extraction via Bun/TypeScript
# shellcheck disable=all

# gsearch pdftotext — PDF text extraction via Bun/TypeScript script
cmd_pdftotext() {
  [ $# -ge 1 ] || die_usage "Usage: gsearch pdftotext <pdf-url>"
  local url="$1"; shift
  case "$url" in *://*) ;; *) url="https://$url" ;; esac

  local script_dir; script_dir=$(cd "$(dirname "$(readlink "$0" 2>/dev/null || echo "$0")")" && pwd)
  # Find the script relative to the gsearch script location
  local extractor; extractor=$(find "$script_dir/.." -name 'pdf-extract.ts' 2>/dev/null | head -1)
  if [ -z "$extractor" ]; then
    # Fallback: look relative to actions.sh
    extractor="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/pdf-extract.ts"
  fi

  if [ ! -f "$extractor" ]; then
    printf '{"error":"pdf_extractor_not_found","detail":"pdf-extract.ts not found"}\n' >&2
    exit 2
  fi

  local text
  text=$(curl -sL --max-time 30 "$url" | bun "$extractor" 2>/dev/null) || {
    local exit_code=$?
    if [ "$exit_code" -eq 1 ]; then
      printf '{"error":"pdf_extraction_failed","detail":"No text could be extracted from PDF"}\n' >&2
    else
      printf '{"error":"pdf_download_failed","detail":"Failed to download PDF from %s"}\n' "$url" >&2
    fi
    exit 2
  }
  printf '{"url":%s,"content":%s}\n' "$(printf '%s' "$url" | bun -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8").trim()))')" "$(printf '%s' "$text" | bun -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8").trim()))')"
}
