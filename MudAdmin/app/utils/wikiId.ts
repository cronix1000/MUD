export function resolveWikiId(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  const match = /\[\[([a-z]+):([^\]]+)\]\]/.exec(trimmed)
  if (!match || match[2] === undefined) return trimmed
  return match[2]
}

export function wrapAsWiki(entityType: string, id: string): string {
  return `[[${entityType}:${id}]]`
}