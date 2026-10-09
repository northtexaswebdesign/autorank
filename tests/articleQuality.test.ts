import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintArticle, extractFaq, buildJsonLd, finalizeForPublish, collectSearchUrls, verifyLinks, isSafePublicUrl, keywordBudget, normalizeUrl } from '../supabase/functions/_shared/articleQuality.ts';

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
