import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsSourcePass, sourceStats, stripFences, isNonContentUrl, lintArticle, extractFaq, buildJsonLd, finalizeForPublish, collectSearchUrls, verifyLinks, isSafePublicUrl, keywordBudget, normalizeUrl, dropTitleH1, researchBriefBlock, stripSourcesSection, OLDEST_SOURCE_YEAR } from '../supabase/functions/_shared/articleQuality.ts';

const kw = 'heavy duty wheelchair drink holder';
const para = (n: number) => '<p>' + 'word '.repeat(n) + '</p>';

test('flags keyword stuffing and heading repetition', () => {
  const stuffed = `<h1>${kw}</h1>` + Array.from({ length: 6 }, () => `<h2>${kw} tips</h2><p>The ${kw} matters. A ${kw} helps.</p>`).join('') + para(900);
  const { issues } = lintArticle(stuffed, { keyword: kw });
  assert.ok(issues.some(i => i.code === 'keyword-stuffing' && i.severity === 'error'));
});

test('natural usage passes keyword check', () => {
  const ok = `<h1>${kw}</h1><p>A ${kw} must stay put.</p><h2>How to choose</h2>` + para(1500);
  assert.ok(!lintArticle(ok, { keyword: kw }).issues.some(i => i.code.startsWith('keyword-stuffing')));
});

test('detects leaked text and unsourced figures', () => {
  const html = `<h1>T</h1><p>No diagram is needed here.</p><p>About 40% of users quit.</p><p>Per <a href="https://www.cdc.gov/x">CDC</a> 12% did.</p>`;
  const { issues } = lintArticle(html, { keyword: kw });
  assert.ok(issues.some(i => i.code === 'leaked-text'));
  const fig = issues.find(i => i.code === 'unsourced-figure');
  assert.ok(fig && /1 statement/.test(fig.message));
});

test('measurements like 7/8 in are not flagged as figures', () => {
  const { issues } = lintArticle('<h1>T</h1><p>Tubes run from 7/8 in to 1 1/4 in.</p>', { keyword: kw });
  assert.ok(!issues.some(i => i.code === 'unsourced-figure'));
});

test('extractFaq and JSON-LD', () => {
  const html = '<h1>T</h1><h2>Frequently Asked Questions</h2><h3>What is X?</h3><p>It is Y.</p><h3>Why Z?</h3><p>Because.</p><h2>Sources</h2><ul></ul>';
  assert.equal(extractFaq(html).length, 2);
  const ld = buildJsonLd({ html, headline: 'T', businessName: 'Acme', businessUrl: 'acme.com' });
  const json = JSON.parse(ld.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
  assert.deepEqual(json['@graph'].map((n: any) => n['@type']), ['Article', 'FAQPage']);
  assert.equal(json['@graph'][0].author.name, 'Acme');
});

test('finalizeForPublish is idempotent', () => {
  const once = finalizeForPublish('<h1>T</h1><p>x</p>', { headline: 'T', businessName: 'A' });
  const twice = finalizeForPublish(once, { headline: 'T', businessName: 'A' });
  assert.equal((twice.match(/ld\+json/g) || []).length, 1);
  assert.equal((twice.match(/Last updated/g) || []).length, 1);
});

test('collectSearchUrls reads tool results and citations', () => {
  const urls = collectSearchUrls([
    { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://a.gov/x' }] },
    { type: 'text', text: 'hi', citations: [{ type: 'web_search_result_location', url: 'https://b.edu/y' }] },
    { type: 'text', text: 'no urls' },
  ]);
  assert.deepEqual(urls.sort(), ['https://a.gov/x', 'https://b.edu/y']);
});

test('verifyLinks drops invented, blocked and unsafe links without touching the network', async () => {
  const html = '<p><a href="https://real.gov/a">ok</a> <a href="https://made-up.com/z">fake</a> <a href="https://www.reddit.com/r/x">forum</a> <a href="http://169.254.169.254/">meta</a></p>';
  const { html: out, report } = await verifyLinks(html, { searchUrls: ['https://www.real.gov/a/'], checkLive: false });
  assert.ok(out.includes('href="https://real.gov/a"'));
  assert.ok(!out.includes('made-up.com') && !out.includes('reddit') && !out.includes('169.254'));
  assert.deepEqual(report.removed.map(r => r.reason).sort(), ['blocked-host', 'not-in-search-results', 'unsafe']);
});

test('helpers', () => {
  assert.ok(!isSafePublicUrl('http://localhost/x') && !isSafePublicUrl('https://10.0.0.1/') && isSafePublicUrl('https://example.com/a'));
  assert.equal(keywordBudget(1800), 7);
  assert.equal(normalizeUrl('https://www.A.com/p/?utm_source=x#h'), 'a.com/p');
});

const body = (extra: string) => `<h1>Guide</h1><h2>Key Takeaways</h2><p>x</p>${extra}<h2>Sources</h2><ul></ul>`;
const cited = '<p><a href="https://www.cdc.gov/a">CDC</a> <a href="https://www.nih.gov/b">NIH</a> <a href="https://www.iso.org/c">ISO</a></p>';

test('an article that says it has no sources is an error and needs the source pass', () => {
  const html = body('<p>This guide contains no statistics or regulatory claims, so no external sources are cited.</p>');
  assert.ok(lintArticle(html, { keyword: kw }).issues.some(i => i.code === 'leaked-text' && i.severity === 'error'));
  assert.equal(needsSourcePass(html), true);
});

test('source pass is not needed once 3 publishers are cited', () => {
  assert.equal(needsSourcePass(body(cited)), false);
  assert.deepEqual(sourceStats(body(cited)), { links: 3, publishers: 3 });
  assert.equal(needsSourcePass(body('<p><a href="https://a.gov/x">A</a> <a href="https://a.gov/y">A2</a></p>')), true); // one publisher
});

test('sitemap links and "site directory" wording are caught', async () => {
  assert.ok(isNonContentUrl('https://shop.com/sitemap.xml') && isNonContentUrl('https://shop.com/feed/') && isNonContentUrl('https://shop.com/?s=cups'));
  assert.ok(!isNonContentUrl('https://shop.com/guides/cup-holders/'));
  const html = '<p>You can browse the <a href="https://shop.com/sitemap.xml">site directory for drink holders</a>.</p>';
  const { issues } = lintArticle(html, { keyword: kw, ownUrl: 'https://shop.com' });
  assert.ok(issues.some(i => i.code === 'non-content-link'));
  assert.ok(issues.some(i => i.code === 'leaked-text' && /awkward link/.test(i.message)));
  const { html: out, report } = await verifyLinks(html, { ownUrl: 'https://shop.com', checkLive: false });
  assert.ok(!out.includes('sitemap.xml') && out.includes('site directory for drink holders'));
  assert.equal(report.removed[0].reason, 'not-a-content-page');
});

test('stripFences keeps HTML that contains brackets', () => {
  assert.equal(stripFences('```html\n<h1>T</h1><p>[IMAGE_1]</p>\n```'), '<h1>T</h1><p>[IMAGE_1]</p>');
});

test('flags unlinked Sources entries, stretched sources and unlinked CTAs', () => {
  const html = '<h1>T</h1><p>That notice concerns electromagnetic interference, not canes. It shows caution.</p><p>Check out our catalog to see these solutions, or message us.</p><h2>Sources</h2><ul><li>FDA, Notice, 1995</li><li><a href="https://fda.gov/x">FDA</a></li></ul>';
  const codes = lintArticle(html, { keyword: kw, ownUrl: 'https://shop.com' }).issues.map(i => i.code);
  for (const c of ['stretched-source', 'unlinked-cta', 'no-internal-links']) assert.ok(codes.includes(c), c);
});

test('a linked CTA and linked sources pass', () => {
  const html = '<h1>T</h1><p>See <a href="https://shop.com/cane-holders/">SnapIt cane holders</a>. Check out our catalog at <a href="https://shop.com/shop/">the shop</a>.</p><h2>Sources</h2><ul><li><a href="https://fda.gov/x">FDA</a>, 2024</li></ul>';
  const codes = lintArticle(html, { keyword: kw, ownUrl: 'https://shop.com' }).issues.map(i => i.code);
  for (const c of ['unlinked-cta', 'no-internal-links']) assert.ok(!codes.includes(c), c);
});

test('dropTitleH1 removes the leading title H1 and demotes any other H1', () => {
    const out = dropTitleH1('<h1>Title</h1><p class="article-updated">x</p><p>a</p><h1 class="y">Extra</h1>');
    assert.equal(out, '<p class="article-updated">x</p><p>a</p><h2 class="y">Extra</h2>');
});

test('researchBriefBlock is empty without research', () => {
    assert.equal(researchBriefBlock(''), '');
    assert.match(researchBriefBlock('GAPS: x'), /RESEARCH BRIEF[\s\S]*GAPS: x/);
});

test('stripSourcesSection removes a trailing Sources list but keeps the FAQ', () => {
    const out = stripSourcesSection('<h2>FAQ</h2><h3>Q?</h3><p>A.</p><h2>Sources</h2><ul><li>x</li></ul>');
    assert.equal(out, '<h2>FAQ</h2><h3>Q?</h3><p>A.</p>');
});

test('flags citations older than the recency limit, but not laws or standards', () => {
    const old = OLDEST_SOURCE_YEAR - 2;
    const html = `<h1>T</h1><p>A ${old} <a href="https://news.example.com/a">report</a> says so.</p><p>The ADA standard (1990) <a href="https://ada.gov/x">applies</a>.</p>`;
    const issues = lintArticle(html, { keyword: 'x', ownUrl: 'https://me.com' }).issues;
    const old_ = issues.find(i => i.code === 'old-source');
    assert.ok(old_ && /1 citation/.test(old_.message));
    const fresh = `<h1>T</h1><p>A ${OLDEST_SOURCE_YEAR} <a href="https://news.example.com/a">report</a> says so.</p>`;
    assert.ok(!lintArticle(fresh, { keyword: 'x' }).issues.some(i => i.code === 'old-source'));
});

test('flags a Sources list at the end', () => {
    assert.ok(lintArticle('<h1>T</h1><p>x</p><h2>Sources</h2><ul><li>a</li></ul>', { keyword: 'x' }).issues.some(i => i.code === 'sources-list'));
});

test('fromYYYYMMDD keeps the local calendar day', async () => {
  const { fromYYYYMMDD, toYYYYMMDD } = await import('../utils/dateUtils.ts');
  assert.equal(toYYYYMMDD(fromYYYYMMDD('2026-10-12')), '2026-10-12');
  assert.equal(fromYYYYMMDD('2026-10-12', 14, 30).getHours(), 14);
});
