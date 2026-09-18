#!/bin/sh
#
# entrypoint-server.sh — runs as root on container start, fixes permissions
# on the bind-mounted/named-volume data dirs, then drops to the mud user
# and execs the actual server.
#
# This is needed because named volumes are created root-owned by Docker, and
# the server process runs as the unprivileged 'mud' user (uid 1001) which
# otherwise can't write into /data.
#
# After the first chown the volume retains the right ownership on subsequent
# container starts; the chown is idempotent.

set -e

if [ -d /data ]; then
    chown -R mud:mud /data
fi

if [ -d /mud ]; then
    chown -R mud:mud /mud
fi

exec gosu mud /mud/ModularMudServer
