import type { ColumnInfo } from '~/utils/column-info'

interface LogicalRef {
  parentTable: string
  parentLabel: (row: Record<string, unknown>) => string
  valueKey: string
  dependsOn?: string
  dependsOnParent?: string
}

const REFS: Record<string, Record<string, LogicalRef>> = {
  world_rooms: {
    region_id: {
      parentTable: 'world_regions',
      valueKey: 'id',
      parentLabel: (r) => `${r.id}${r.name ? ' — ' + r.name : ''}`,
    },
    zone_id: {
      parentTable: 'world_zones',
      valueKey: 'zone_id',
      dependsOn: 'region_id',
      dependsOnParent: 'region_id',
      parentLabel: (r) => `#${r.zone_id}${r.name ? ' — ' + r.name : ''}`,
    },
  },
  world_room_exits: {
    region_id: {
      parentTable: 'world_regions',
      valueKey: 'id',
      parentLabel: (r) => `${r.id}${r.name ? ' — ' + r.name : ''}`,
    },
  },
  world_room_spawns: {
    region_id: {
      parentTable: 'world_regions',
      valueKey: 'id',
      parentLabel: (r) => `${r.id}${r.name ? ' — ' + r.name : ''}`,
    },
  },
  world_zones: {
    region_id: {
      parentTable: 'world_regions',
      valueKey: 'id',
      parentLabel: (r) => `${r.id}${r.name ? ' — ' + r.name : ''}`,
    },
  },
}

export function getLogicalRef(table: string, column: string): LogicalRef | null {
  return REFS[table]?.[column] ?? null
}

export function isAutoManagedColumn(col: ColumnInfo): boolean {
  return col.is_identity === 1
}