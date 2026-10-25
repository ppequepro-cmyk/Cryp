import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRgbCommand } from '../plugins/rgb.js';

test('acepta los tres alias RGB con texto', () => {
  assert.equal(parseRgbCommand('.rgb Hola mundo'), 'Hola mundo');
  assert.equal(parseRgbCommand('.rgb1 Texto'), 'Texto');
  assert.equal(parseRgbCommand('.arcoiris NORE'), 'NORE');
});

test('rechaza alias RGB sin texto o con texto demasiado largo', () => {
  assert.equal(parseRgbCommand('.rgb'), null);
  assert.equal(parseRgbCommand('.arcoiris   '), null);
  assert.equal(parseRgbCommand('.rgb ' + 'x'.repeat(501)), null);
});

test('no interpreta comandos que solo contienen el alias como parte de otra palabra', () => {
  assert.equal(parseRgbCommand('hola .rgb mundo'), null);
});
