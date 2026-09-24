# Postgres connection from C++ server

## Symptom (from a recent mud-server boot)

```
[Postgres] Connect failed: connection to server at "<vps-host>", port 5432
        failed: Connection timed out (0x0000274C/10060)
        Is the server running on that host and accepting TCP/IP connections?
```

Windows Winsock error `10060` = `WSAETIMEDOUT`. The C++ binary is **not** the
issue; it's trying to dial the wrong network endpoint.

## Why this happens

Layout:

```
+--------------------------+                     +----------------------------+
|   Windows host (cronix)  |    ssh -L forward   |   Ubuntu VPS (<vps-host>) |
|                          |  ---------------->  |                            |
|  mud-server.exe          |   local 5432        |  docker compose stack      |
|  MUD_DATABASE_URL =      |   to remote 127.0.0 |                            |
|   ...@<vps-host>:5432   |                     |  mud-postgres              |
+--------------------------+                     |   (only on bridge network) |
                                                +----------------------------+
```

Two things have to be true for mud-server.exe to reach Postgres:

1. The Postgres container must be reachable at `127.0.0.1:5432` *on the VPS*.
   Today it's only on the `postgre_default` docker bridge (no `ports:` mapping
   on the postgres service), so the host itself can't reach it.
2. The C++ server's `MUD_DATABASE_URL` must point at something the local
   Windows machine can resolve. Two options:
   - **SSH tunnel:** from Windows, `ssh -L 5432:127.0.0.1:5432 ubuntu@<vps-host>`
     Then set `MUD_DATABASE_URL=postgresql://mud_prod:...@127.0.0.1:5432/mud_prod`.
   - **Public exposure:** open VPS firewall `5432/tcp`, set `MUD_DATABASE_URL=postgresql://mud_prod:...@<vps-host>:5432/mud_prod`. **Not recommended.**

## Recommended fix (two changes)

### Change 1: SSH tunnel the C++ server's Postgres connection (Windows side)

In a Windows terminal (PowerShell, Windows Terminal, or any ssh client):

```
ssh -L 5432:127.0.0.1:5432 ubuntu@<vps-host>
```

Leave that terminal open. In another terminal, run `mud-server.exe`.
`MUD_DATABASE_URL` should be:

```
postgresql://mud_prod:super_mud_pass_1@127.0.0.1:5432/mud_prod
```

This works *only if* the Postgres container has a host port mapping (Change 2).

### Change 2: publish Postgres to the host loopback (VPS side, durable)

On the VPS, edit `~/postgre/docker-compose.yml`. In the `postgres:` service,
add:

```yaml
postgres:
  image: postgres:16-alpine
  ...
  ports:
    - "127.0.0.1:5432:5432"   # host loopback only; not on the public internet
```

Then:

```
cd ~/postgre
docker compose up -d
```

Verify:

```
docker exec mud-postgres pg_isready -U postgres
# expect: "127.0.0.1:5432 - accepting connections"
```

Now `psql -h 127.0.0.1 -U mud_prod -d mud_prod` from the VPS works directly,
and the SSH tunnel carries those bytes through to Windows.

## Why this is preferred over public exposure

- Public `5432` is a brute-force target. Even with `scram-sha-256` and a strong
  password, every internet scanner will probe it.
- SSH tunnel reuses the existing auth surface (SSH key or password) and adds
  transport encryption to every Postgres packet.
- Lets the C++ server use `127.0.0.1:5432`, the same URL pattern it would use
  against any local dev Postgres.

## If you want public exposure anyway

(Not recommended. Don't do this on a publicly-known IP.)

```
# On the VPS
sudo ufw allow 5432/tcp
# Cloud-provider firewall: open 5432/tcp inbound from your office/home IP only.
```

Then change Postgres `ports:` to `"5432:5432"` (bind on `0.0.0.0`). On Windows,
`MUD_DATABASE_URL` becomes `postgresql://mud_prod:...@<vps-host>:5432/mud_prod`.

## Checklist

- [ ] VPS: `~/postgre/docker-compose.yml` postgres service has `ports: ["127.0.0.1:5432:5432"]`.
- [ ] VPS: `docker compose up -d` applied.
- [ ] Windows: SSH tunnel alive: `ssh -L 5432:127.0.0.1:5432 ubuntu@<vps-host>`.
- [ ] Windows: `MUD_DATABASE_URL=postgresql://mud_prod:super_mud_pass_1@127.0.0.1:5432/mud_prod`.
- [ ] mud-server.exe log shows `[Postgres] Connect OK` (or similar) instead of the timeout.

## Still pending (separate work)

- `wiki/` credentials still in git history. Recommend `git filter-repo --invert-paths --path wiki/` + force-push, then rotate all DB passwords.
- `super_mud_pass_1` is reused across `POSTGRES_PASSWORD`, `MUD_PROD_PASSWORD`, `MUD_BETA_PASSWORD`, and `mud_prod`/`mud_beta` role passwords. Rotate to distinct values per role after cutover.
- PR 5 doc cleanup (`ModularMudServer/AGENTS.md` SQLite->libpqxx mentions; root `AGENTS.md` consistency).
- Deprecate the repo's `~/MUD/docker/postgresql/docker-compose.yml` (the canonical install now lives at `~/postgre/` on the VPS).
