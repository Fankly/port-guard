#!/bin/sh
# READ ONLY: no -e/-E/-d/-X/-f/-F/-k flags, no network capture.
set -eu
if [ "$(/usr/bin/id -u)" -ne 0 ]; then
    echo 'This read-only PF preflight requires macOS administrator authorization.' >&2
    exit 1
fi
/usr/bin/uname -r
/sbin/pfctl -s info
/sbin/pfctl -s Anchors
/sbin/pfctl -sr
