export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: 0 | 1
  dflt_value: unknown
  pk: 0 | 1
  is_identity: 0 | 1
  fk: { schema: string; table: string; column: string } | null
}