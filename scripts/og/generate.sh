#!/usr/bin/env bash
# OG 圖生成:用系統 Chrome headless 截圖 —— 零新依賴,而且 woff2 像素字型的
# 光柵化就是瀏覽器本人,不會有 SVG rasterizer 吃不到字型的問題。
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --screenshot="../../public/og.png" \
  --window-size=1200,630 --hide-scrollbars --force-device-scale-factor=1 \
  "file://$PWD/og.html"
echo "og.png: $(du -h ../../public/og.png | cut -f1)"
