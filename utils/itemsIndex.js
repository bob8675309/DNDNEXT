// utils/itemsIndex.js
export async function loadItemsIndex() {
  const res = await fetch('/all-items.json', { cache: 'no-store' });
  const raw = await res.json();
  // build a fast lookup by normalized name
  const norm = s => (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\+\-’'()]/g, '')  // drop punctuation except a few
    .replace(/\s+/g, ' ')
    .trim();
  const byKey = {};
  for (const it of raw) {
    const k = norm(it.name);
    if (k) byKey[k] = it;
  }
  return { byKey, norm };
}
