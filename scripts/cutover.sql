-- cutover.sql
-- Idempotent schema bootstrap for the SQLite -> Postgres cutover.
--
-- Run via pgAdmin Query Tool against `mud_prod` (F5), or from a shell:
--   PGPASSWORD='<mud_prod password>' psql \
--     -h 127.0.0.1 -U mud_prod -d mud_prod \
--     -v ON_ERROR_STOP=1 -f cutover.sql
--
-- Properties:
--   * Atomic: every statement runs inside one BEGIN/COMMIT block.
--   * Idempotent: re-runs from scratch by DROP SCHEMA ... CASCADE first.
--   * Schema-qualified everywhere: search_path is irrelevant within this session.
--   * Tables only: no data load. Data load is a separate step (see cutover-data.sh).
--
-- Naming conventions used here:
--   world.*        -- static world content (mirrors ~/MUD/ModularMudServer/mud.world.db)
--   players.*      -- canonical player data (mirrors ~/MUD/ModularMudServer/mud.players.db)
--   _meta.*        -- migration bookkeeping for MudAdmin's /admin/_migrate page
--
-- Decoupling decision (locked-in during this cutover):
--   The legacy `players` table inside `mud.world.db` is intentionally NOT carried
--   over. Its data lives in `players.player_players` (from `mud.players.db`).
--   If any C++ query still expects the unqualified `players` table, that has to
--   be fixed in PostgresDatabase.cpp alongside this migration.

BEGIN;

DROP SCHEMA IF EXISTS world   CASCADE;
DROP SCHEMA IF EXISTS players CASCADE;
DROP SCHEMA IF EXISTS _meta   CASCADE;

CREATE SCHEMA world;
CREATE SCHEMA players;
CREATE SCHEMA _meta;

-- _meta._migrations
-- -----------------------------
-- Schema must match what MudAdmin/server/utils/migrate.ts expects:
--   version    INTEGER PRIMARY KEY
--   name       TEXT NOT NULL
--   applied_at BIGINT NOT NULL   (unix epoch milliseconds, populated at insert)
--   note       TEXT
-- Rows for versions 1..15 are inserted below so MudAdmin's
-- /admin/_migrate page shows all green on first load.

CREATE TABLE _meta._migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at BIGINT  NOT NULL,
    note       TEXT
);

INSERT INTO _meta._migrations (version, name, applied_at, note) VALUES
    ( 1, 'add_dialogue_root_to_world_mobs',        0, 'seeded by cutover.sql'),
    ( 2, 'create_world_quests',                    0, 'seeded by cutover.sql'),
    ( 3, 'create_world_quest_objectives',          0, 'seeded by cutover.sql'),
    ( 4, 'create_world_quest_rewards',             0, 'seeded by cutover.sql'),
    ( 5, 'add_symbol_width_to_world_worlds',       0, 'seeded by cutover.sql'),
    ( 6, 'migrate_floor_settings_overrides',       0, 'seeded by cutover.sql'),
    ( 7, 'create_migrations_table_marker',         0, 'seeded by cutover.sql'),
    ( 8, 'add_pattern_to_world_terrains',          0, 'seeded by cutover.sql'),
    ( 9, 'auto_assign_patterns_to_default_tiles',  0, 'seeded by cutover.sql'),
    (10, 'drop_pattern_column_from_world_terrains',0, 'seeded by cutover.sql'),
    (11, 'add_region_metadata',                    0, 'seeded by cutover.sql'),
    (12, 'create_world_recipes',                   0, 'seeded by cutover.sql'),
    (13, 'create_player_known_recipes',            0, 'seeded by cutover.sql'),
    (14, 'add_xp_curve_to_world_skills',           0, 'seeded by cutover.sql'),
    (15, 'add_station_type_to_world_interactables',0, 'seeded by cutover.sql');

-- world.worlds
-- -----------------------------
CREATE TABLE world.worlds (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    created_at    INTEGER,
    symbol_width  INTEGER DEFAULT 1
);

-- world.regions
-- -----------------------------
CREATE TABLE world.regions (
    world_id                    TEXT NOT NULL REFERENCES world.worlds(id),
    id                          TEXT NOT NULL,
    name                        TEXT NOT NULL,
    description                 TEXT,
    theme                       TEXT,
    floor_settings_json         TEXT,
    floor_settings_deprecated_at INTEGER,
    region_kind                 TEXT DEFAULT 'static',
    generator_script            TEXT,
    template_config_json        TEXT,
    tutorial_steps_json         TEXT,
    PRIMARY KEY (world_id, id)
);

-- world.terrains
-- -----------------------------
CREATE TABLE world.terrains (
    world_id      TEXT NOT NULL,
    symbol        TEXT NOT NULL,
    name          TEXT NOT NULL,
    color         TEXT,
    blocks_move   INTEGER DEFAULT 0,
    blocks_sight  INTEGER DEFAULT 0,
    move_cost     INTEGER DEFAULT 1,
    PRIMARY KEY (world_id, symbol)
);

-- world.rooms
-- -----------------------------
CREATE TABLE world.rooms (
    world_id      TEXT NOT NULL,
    region_id     TEXT NOT NULL,
    room_id       INTEGER NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    terrain       TEXT,
    width         INTEGER,
    height        INTEGER,
    layout_json   TEXT,
    spawn_x       INTEGER,
    spawn_y       INTEGER,
    scripts_json  TEXT,
    extra_json    TEXT,
    PRIMARY KEY (world_id, region_id, room_id),
    FOREIGN KEY (world_id, region_id)
        REFERENCES world.regions(world_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_world_rooms_region ON world.rooms (world_id, region_id);

-- world.room_exits
-- -----------------------------
CREATE TABLE world.room_exits (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    world_id      TEXT NOT NULL,
    region_id     TEXT NOT NULL,
    from_room_id  INTEGER NOT NULL,
    direction     TEXT NOT NULL,
    to_room_id    INTEGER NOT NULL,
    dest_x        INTEGER DEFAULT -1,
    dest_y        INTEGER DEFAULT -1,
    is_one_way    INTEGER DEFAULT 0,
    is_portal     INTEGER DEFAULT 0,
    portal_name   TEXT,
    auto_trigger  INTEGER DEFAULT 0
);
CREATE INDEX idx_world_exits_from ON world.room_exits (world_id, region_id, from_room_id);

-- world.room_spawns
-- -----------------------------
CREATE TABLE world.room_spawns (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    world_id      TEXT NOT NULL,
    region_id     TEXT NOT NULL,
    room_id       INTEGER NOT NULL,
    x             INTEGER NOT NULL,
    y             INTEGER NOT NULL,
    type          TEXT NOT NULL,
    template_id   TEXT NOT NULL,
    respawn_time  DOUBLE PRECISION DEFAULT 30.0,
    is_respawning INTEGER DEFAULT 1,
    override_json TEXT
);

-- world.items
-- -----------------------------
CREATE TABLE world.items (
    world_id        TEXT NOT NULL,
    template_id     TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    char            TEXT,
    color           TEXT,
    value           INTEGER DEFAULT 0,
    weight          INTEGER DEFAULT 0,
    equippable      INTEGER DEFAULT 0,
    type            TEXT,
    components_json TEXT,
    script_ref      TEXT,
    PRIMARY KEY (world_id, template_id)
);

-- world.mobs
-- -----------------------------
CREATE TABLE world.mobs (
    world_id              TEXT NOT NULL,
    template_id           TEXT NOT NULL,
    name                  TEXT NOT NULL,
    description           TEXT,
    char                  TEXT,
    color                 TEXT,
    hp                    INTEGER DEFAULT 1,
    level                 INTEGER DEFAULT 1,
    ai                    TEXT,
    loot_drop             TEXT,
    strength              INTEGER DEFAULT 0,
    dexterity             INTEGER DEFAULT 0,
    intelligence          INTEGER DEFAULT 0,
    attack_damage         INTEGER DEFAULT 0,
    attack_speed          DOUBLE PRECISION DEFAULT 0,
    crit_chance           DOUBLE PRECISION DEFAULT 0,
    crit_mult             DOUBLE PRECISION DEFAULT 1.5,
    attack_patterns_json  TEXT,
    script_ref            TEXT,
    extra_json            TEXT,
    dialogue_root         TEXT,
    PRIMARY KEY (world_id, template_id)
);

-- world.interactables
-- -----------------------------
CREATE TABLE world.interactables (
    world_id        TEXT NOT NULL,
    template_id     TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    char            TEXT,
    color           TEXT,
    components_json TEXT,
    script_ref      TEXT,
    station_type    TEXT,
    PRIMARY KEY (world_id, template_id)
);

-- world.dialogues
-- -----------------------------
CREATE TABLE world.dialogues (
    world_id      TEXT NOT NULL,
    node_id       TEXT NOT NULL,
    text          TEXT,
    idle_json     TEXT,
    combat_json   TEXT,
    death_json    TEXT,
    options_json  TEXT,
    PRIMARY KEY (world_id, node_id)
);

-- world.skill_categories
-- -----------------------------
CREATE TABLE world.skill_categories (
    world_id      TEXT NOT NULL,
    category_id   TEXT NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    stats_json    TEXT,
    synergy_bonus DOUBLE PRECISION DEFAULT 0,
    PRIMARY KEY (world_id, category_id)
);

-- world.skills
-- -----------------------------
CREATE TABLE world.skills (
    world_id          TEXT NOT NULL,
    skill_id          TEXT NOT NULL,
    category_id       TEXT,
    name              TEXT NOT NULL,
    description       TEXT,
    type              TEXT,
    activation        TEXT,
    command           TEXT,
    cooldown          DOUBLE PRECISION DEFAULT 0,
    windup            DOUBLE PRECISION DEFAULT 0,
    costs_json        TEXT,
    targeting         TEXT,
    range             INTEGER DEFAULT 0,
    script_ref        TEXT,
    xp_curve          TEXT DEFAULT 'linear',
    xp_curve_params   TEXT,
    PRIMARY KEY (world_id, skill_id)
);

-- world.loot_tables
-- -----------------------------
CREATE TABLE world.loot_tables (
    world_id      TEXT NOT NULL,
    table_id      TEXT NOT NULL,
    name          TEXT,
    entries_json  TEXT,
    PRIMARY KEY (world_id, table_id)
);

-- world.region_overrides
-- -----------------------------
CREATE TABLE world.region_overrides (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    world_id      TEXT NOT NULL,
    region_id     TEXT NOT NULL,
    target_type   TEXT NOT NULL,
    target_id     TEXT NOT NULL,
    override_json TEXT NOT NULL
);

-- world.field_definitions
-- -----------------------------
CREATE TABLE world.field_definitions (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    world_id          TEXT NOT NULL,
    entity_type       TEXT NOT NULL,
    field_name        TEXT NOT NULL,
    field_type        TEXT NOT NULL,
    label             TEXT,
    help_text         TEXT,
    enum_values_json  TEXT,
    min_value         DOUBLE PRECISION,
    max_value         DOUBLE PRECISION,
    default_value     TEXT,
    editable          INTEGER DEFAULT 1,
    display_order     INTEGER DEFAULT 0,
    region_id         TEXT
);
CREATE INDEX idx_world_field_defs_entity
    ON world.field_definitions (world_id, entity_type);

-- world.quests
-- -----------------------------
CREATE TABLE world.quests (
    world_id      TEXT NOT NULL,
    quest_id      TEXT NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    script_ref    TEXT,
    PRIMARY KEY (world_id, quest_id)
);

-- world.quest_objectives
-- -----------------------------
CREATE TABLE world.quest_objectives (
    world_id    TEXT NOT NULL,
    quest_id    TEXT NOT NULL,
    ordinal     INTEGER NOT NULL,
    kind        TEXT NOT NULL,
    target      TEXT,
    count       INTEGER DEFAULT 1,
    PRIMARY KEY (world_id, quest_id, ordinal)
);

-- world.quest_rewards
-- -----------------------------
CREATE TABLE world.quest_rewards (
    world_id      TEXT NOT NULL,
    quest_id      TEXT NOT NULL,
    ordinal       INTEGER NOT NULL,
    kind          TEXT NOT NULL,
    payload_json  TEXT,
    PRIMARY KEY (world_id, quest_id, ordinal)
);

-- world.recipes
-- -----------------------------
CREATE TABLE world.recipes (
    world_id                TEXT NOT NULL,
    recipe_id               TEXT NOT NULL,
    name                    TEXT NOT NULL,
    description             TEXT,
    skill_id                TEXT,
    required_skill_level    INTEGER DEFAULT 0,
    station_type            TEXT,
    outputs_json            TEXT,
    inputs_json             TEXT,
    craft_time_seconds      DOUBLE PRECISION DEFAULT 3.0,
    experience_gain         INTEGER DEFAULT 0,
    script_ref              TEXT,
    is_auto_learned         INTEGER DEFAULT 1,
    PRIMARY KEY (world_id, recipe_id)
);

-- players.player_players
-- -----------------------------
CREATE TABLE players.player_players (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    region_id       TEXT DEFAULT 'floor1',
    account_id      INTEGER UNIQUE,
    permission      INTEGER NOT NULL,
    name            TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    salt            TEXT NOT NULL,
    room_id         INTEGER DEFAULT 1,
    data            TEXT NOT NULL
);

-- players.player_items
-- -----------------------------
CREATE TABLE players.player_items (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id     BIGINT NOT NULL REFERENCES players.player_players(id) ON DELETE CASCADE,
    template_id  TEXT NOT NULL,
    item_state   TEXT NOT NULL
);

-- players.player_known_recipes
-- -----------------------------
CREATE TABLE players.player_known_recipes (
    uid          INTEGER NOT NULL,
    world_id     TEXT NOT NULL,
    recipe_id    TEXT NOT NULL,
    learned_at   INTEGER NOT NULL,
    PRIMARY KEY (uid, world_id, recipe_id)
);

COMMIT;

-- After this script completes, run:
--   SELECT count(*) FROM information_schema.tables
--    WHERE table_schema IN ('world','players','_meta');
-- and expect 22.
--
--   SELECT version, name FROM _meta._migrations ORDER BY version;
-- and expect 15 rows, version 1..15, all applied.

-- MudAdmin connect note:
-- After the cutover, point MudAdmin's MUD_DATABASE_URL at the same server/db
-- and visit /admin/_migrate. It will show all 15 migrations as already
-- applied (green). "Run pending" is a no-op since the pending set is empty.
