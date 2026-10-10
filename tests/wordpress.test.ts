import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findExistingWpPost, slugFromUrl } from '../supabase/functions/_shared/wordpress.ts';

const withFetch = async (handler: (url: string) => { ok: boolean; body?: unknown }, run: () => Promise<void>) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string) => { const r = handler(String(url)); return { ok: r.ok, json: async () => r.body }; }) as any;
  try { await run(); } finally { globalThis.fetch = original; }
};

test('slugFromUrl reads the saved slug, including a -2 suffix', () => {
  assert.equal(slugFromUrl('https://site.com/blog/my-post-2/'), 'my-post-2');
  assert.equal(slugFromUrl('not a url'), null);
});

test('findExistingWpPost prefers the saved id and only looks up slugs when told to', async () => {
  await withFetch(url => url.includes('/posts/42') ? { ok: true } : { ok: true, body: [{ id: 7 }] }, async () => {
    assert.equal(await findExistingWpPost('https://s/wp-json/wp/v2', 'Basic x', { wpPostId: 42, slug: 'a', lookUpSlug: false }), 42);
    assert.equal(await findExistingWpPost('https://s/wp-json/wp/v2', 'Basic x', { slug: 'a', lookUpSlug: false }), null);
    assert.equal(await findExistingWpPost('https://s/wp-json/wp/v2', 'Basic x', { slug: 'a', lookUpSlug: true }), 7);
  });
  // a deleted post (404 on the saved id) falls back to the slug lookup, or to creating a new post
  await withFetch(url => url.includes('/posts/42') ? { ok: false } : { ok: true, body: [] }, async () => {
    assert.equal(await findExistingWpPost('https://s/wp-json/wp/v2', 'Basic x', { wpPostId: 42, slug: 'a', lookUpSlug: true }), null);
  });
});
