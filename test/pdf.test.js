import test from 'node:test';
import assert from 'node:assert/strict';
import { createPdfBuffer, readPdf } from '../src/pdf.js';

test('crea un PDF válido y permite leer su texto', async () => {
  const buffer = await createPdfBuffer('Apuntes de prueba', 'Este es un documento de prueba de NORE.');
  assert.ok(buffer.subarray(0, 5).toString() === '%PDF-');
  const text = await readPdf(buffer);
  assert.match(text, /documento de prueba/);
});

test('rechaza crear PDF sin contenido', async () => {
  await assert.rejects(() => createPdfBuffer('Vacío', '  '), /contenido/);
});
