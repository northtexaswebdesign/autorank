import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articleSections, insertImagePlaceholders, figureHtml, replaceImagePlaceholder } from '../supabase/functions/_shared/inlineImages.ts';

const html = `<p>Intro.</p>
<h2>Why <strong>mobile</strong> tinting</h2><p>First para.</p><p>Second para.</p>
<h2>Texas tint laws</h2><ul><li>25% VLT</li></ul>
<h2>FAQ</h2><p>Q and A.</p>`;

test('articleSections reads H2 headings (tags stripped) and the start of each section', () => {
  const s = articleSections(html);
  assert.deepEqual(s.map(x => x.heading), ['Why mobile tinting', 'Texas tint laws', 'FAQ']);
  assert.equal(s[0].text, 'First para. Second para.');
  assert.equal(s[1].text, '25% VLT');
});

test('insertImagePlaceholders goes after the first paragraph of the matching section, or after the H2', () => {
  const r = insertImagePlaceholders(html, [{ heading: 'why mobile tinting', n: 2 }, { heading: 'Texas tint laws', n: 3 }, { heading: 'Missing', n: 4 }]);
  assert.deepEqual(r.placed, [2, 3]);
  assert.ok(r.html.includes('<p>First para.</p>\n<p>[IMAGE_2]</p>\n<p>Second para.</p>'));
  assert.ok(r.html.includes('<h2>Texas tint laws</h2>\n<p>[IMAGE_3]</p>\n<ul>'));
  // a placeholder already in the article is not added twice
  assert.deepEqual(insertImagePlaceholders(r.html, [{ heading: 'FAQ', n: 2 }]).placed, []);
});

test('figureHtml escapes text and only links https credits', () => {
  const f = figureHtml('https://x/a.jpg', 'A "quoted" <alt>', 'Photo: Jo / Pexels', 'https://www.pexels.com/photo/1/');
  assert.ok(f.includes('alt="A &quot;quoted&quot; &lt;alt&gt;"'));
  assert.ok(f.includes('<a href="https://www.pexels.com/photo/1/"'));
  assert.ok(!figureHtml('u', 'a', 'cap', 'javascript:alert(1)').includes('<a '));
  assert.ok(!figureHtml('u', 'a').includes('figcaption'));
});

test('replaceImagePlaceholder swaps the placeholder together with its paragraph', () => {
  assert.equal(replaceImagePlaceholder('<p>a</p><p> [IMAGE_2] </p><p>b</p>', 2, '<figure/>'), '<p>a</p><figure/><p>b</p>');
  assert.equal(replaceImagePlaceholder('x [IMAGE_3] y', 3, 'F'), 'x F y');
  assert.equal(replaceImagePlaceholder('[IMAGE_2]', 3, 'F'), '[IMAGE_2]');
});
