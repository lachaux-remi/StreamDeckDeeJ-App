export interface AutocompleteSuggestion {
  value: string
  label?: string
  detail?: string
  /** Suggestions with a lower priority value are listed first. */
  priority?: number
}

/** Ranks matches: priority, then prefix matches, then alphabetical order. */
export function filterSuggestions(
  suggestions: AutocompleteSuggestion[],
  query: string,
  maxResults: number
): AutocompleteSuggestion[] {
  const needle = query.trim().toLowerCase()
  return suggestions
    .filter(
      (suggestion) =>
        !needle ||
        suggestion.value.toLowerCase().includes(needle) ||
        suggestion.label?.toLowerCase().includes(needle)
    )
    .sort(
      (a, b) =>
        (a.priority ?? 1) - (b.priority ?? 1) ||
        Number(!a.value.toLowerCase().startsWith(needle)) -
          Number(!b.value.toLowerCase().startsWith(needle)) ||
        a.value.localeCompare(b.value)
    )
    .slice(0, maxResults)
}
