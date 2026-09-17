export function resolveWikiId(value: string | null | undefined, worldId?: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  const match = /\[\[([a-z]+):([^\]]+)\]\]/.exec(trimmed)
  if (!match || match[2] === undefined) return trimmed
  let id = match[2]
  if (worldId && id.startsWith(`${worldId}::`)) {
    id = id.slice(worldId.length + 2)
  }
  return id
}

export function wrapAsWiki(entityType: string, id: string): string {
  return `[[${entityType}:${id}]]`
}
