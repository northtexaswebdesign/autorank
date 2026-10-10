/**
 * WordPress helpers shared by the web app and the auto-publisher (plain fetch, runs in the browser and Deno).
 */

/**
 * The WordPress post an article already became, so publishing again updates it instead of creating a copy.
 * Uses the saved post id; looks a post up by slug only when told to (the article was published before, or a
 * previous attempt may have created the post before failing), never for a first publish, so an unrelated post
 * that happens to share the slug is not overwritten.
 */
export const findExistingWpPost = async (
    apiBase: string,
    authHeader: string,
    o: { wpPostId?: number | null; slug?: string | null; lookUpSlug: boolean },
): Promise<number | null> => {
    const headers = { Authorization: authHeader };
    if (o.wpPostId) {
        const res = await fetch(`${apiBase}/posts/${o.wpPostId}?context=edit&_fields=id`, { headers }).catch(() => null);
        if (res?.ok) return o.wpPostId;
    }
    if (o.lookUpSlug && o.slug) {
        const res = await fetch(`${apiBase}/posts?slug=${encodeURIComponent(o.slug)}&status=publish,future,draft,pending,private&context=edit&_fields=id`, { headers }).catch(() => null);
        if (res?.ok) {
            const list = await res.json().catch(() => []);
            if (Array.isArray(list) && typeof list[0]?.id === 'number') return list[0].id;
        }
    }
    return null;
};

/** The last path segment of a published post URL (its slug as WordPress saved it, which may carry a -2). */
export const slugFromUrl = (url?: string | null): string | null => {
    if (!url) return null;
    try { return new URL(url).pathname.split('/').filter(Boolean).pop() || null; } catch { return null; }
};
