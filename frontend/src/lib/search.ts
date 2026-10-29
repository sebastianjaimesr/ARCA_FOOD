// Búsqueda tolerante a tildes y mayúsculas: "jalapenos" encuentra "Jalapeños".
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = normalize(fields.filter(Boolean).join(' '))
  return terms.every((term) => haystack.includes(term))
}
