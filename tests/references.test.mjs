import test from 'node:test';
import assert from 'node:assert/strict';
import { references, recommendReferences, appendCitation, citation, bibtex } from '../lib/references.ts';

test('topic keywords outrank a different project field and explain the match', () => {
  const result = recommendReferences('생명과학', 'F1 공기역학 다운포스');
  assert.equal(result[0].ref.id, 'katz2006');
  assert.ok(result[0].matches.includes('공기역학'));
  assert.ok(result[0].reason.includes('다운포스'));
});
test('English short keywords require word boundaries', () => {
  const result = recommendReferences('기타', 'brain strain');
  assert.equal(result.find(item => item.ref.id === 'crispr2012').matches.length, 0);
});
test('saved citations preserve user notes and do not duplicate on repeated saves', () => {
  const ref = references.find(item => item.id === 'katz2006');
  const text = appendCitation('기존 원자료 경로', ref);
  assert.ok(text.startsWith('기존 원자료 경로\n\n'));
  assert.ok(text.includes(citation(ref)));
  assert.equal(appendCitation(text, ref), text);
  assert.ok(bibtex(ref).includes('10.1146/annurev.fluid.38.050304.092016'));
});
test('catalog has unique identities and HTTPS sources; method references remain available', () => {
  assert.equal(new Set(references.map(ref => ref.id)).size, references.length);
  for (const ref of references) assert.equal(new URL(ref.url).protocol, 'https:');
  const result = recommendReferences('기타', '');
  assert.ok(result.filter(item => item.score > 0).every(item => item.ref.fields.includes('공통')));
});
