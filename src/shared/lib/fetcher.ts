export async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status} ${res.statusText}`);
    throw error;
  }
  return res.json();
}
