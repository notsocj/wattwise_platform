/**
 * Supabase query builders are lazy: the request only starts when something
 * calls `.then()`. Use this to kick off independent queries immediately and
 * await them later. The no-op catch keeps a query that ends up unused (e.g.
 * after an early redirect) from surfacing as an unhandled rejection; awaiting
 * the returned promise still sees the original result or error.
 */
export function startQuery<T>(query: PromiseLike<T>): Promise<T> {
  const started = Promise.resolve(query);
  started.catch(() => undefined);
  return started;
}
