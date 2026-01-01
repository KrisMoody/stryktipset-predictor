/**
 * Deep merge utility for scraped data
 *
 * When re-scraping, this preserves existing non-null values
 * if the new scrape returns null for those fields.
 *
 * Strategy:
 * - If incoming value is null/undefined and existing value exists, keep existing
 * - If incoming value is non-null, use incoming value (overwrite)
 * - Recursively merge nested objects
 * - Arrays are replaced entirely (not merged element-by-element)
 */
export function deepMergeScrapedData<T extends Record<string, unknown>>(
  existing: T | null | undefined,
  incoming: T | null | undefined
): T | null {
  // If no existing data, return incoming
  if (!existing) return (incoming ?? null) as T | null

  // If no incoming data, keep existing
  if (!incoming) return existing

  const result = { ...existing } as Record<string, unknown>

  for (const key of Object.keys(incoming)) {
    const incomingValue = incoming[key]
    const existingValue = existing[key]

    // If incoming is explicitly null/undefined, keep existing
    if (incomingValue === null || incomingValue === undefined) {
      continue // Keep existing value
    }

    // If both are objects (not arrays), recursively merge
    if (
      typeof incomingValue === 'object' &&
      typeof existingValue === 'object' &&
      !Array.isArray(incomingValue) &&
      !Array.isArray(existingValue) &&
      existingValue !== null
    ) {
      result[key] = deepMergeScrapedData(
        existingValue as Record<string, unknown>,
        incomingValue as Record<string, unknown>
      )
    } else {
      // Replace with incoming value (including arrays)
      result[key] = incomingValue
    }
  }

  return result as T
}
