#!/usr/bin/env sh
# Keep CI Word/PDF conversion identical to the deployed Alpine runtime.
# The renderer creates private work directories under /tmp and removes them.
set -eu
exec docker run --rm --network none \
  --user "$(id -u):$(id -g)" \
  --env FONTCONFIG_FILE \
  --volume /tmp:/tmp \
  --entrypoint /usr/bin/soffice \
  shuzhi-backend:ci "$@"
