/**
 * Asserts that a value is defined, narrowing it and throwing otherwise.
 *
 * Used after requests that the Domeneshop API guarantees a body for on
 * success (single-resource GETs, creates and updates), so callers get a
 * concrete type instead of threading `| undefined` through the client.
 */
export function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}
