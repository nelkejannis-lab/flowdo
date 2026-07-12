/** Normalize Supabase join results that may be object or array. */
export function single<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value
}
