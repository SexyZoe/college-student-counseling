#!/usr/bin/env sh
# Keep CI Word/Excel/PDF conversion and raster previews identical to deployment.
# The renderer creates private work directories under /tmp and removes them.
set -eu
case "$(basename "$0")" in
  soffice) converter=/usr/bin/soffice ;;
  pdftoppm) converter=/usr/bin/pdftoppm ;;
  *) echo "Unsupported document tool" >&2; exit 1 ;;
esac
exec docker run --rm --network none \
  --user "$(id -u):$(id -g)" \
  --env FONTCONFIG_FILE \
  --volume /tmp:/tmp \
  --entrypoint "$converter" \
  shuzhi-backend:ci "$@"
