export async function jsonFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "We could not load that data right now."
    );
  }

  return payload as T;
}
