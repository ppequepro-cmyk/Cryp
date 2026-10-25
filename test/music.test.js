import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMusicIntent, parsePlayCommand } from '../src/music.js';

test('detecta canción, título y artista en una mención positiva de grupo', () => {
  const result = detectMusicIntent('La canción de FES de Víctor Mendívil está buena');
  assert.equal(result?.title, 'FES');
  assert.equal(result?.artist, 'Víctor Mendívil');
});

test('detecta una petición explícita de reproducción', () => {
  const result = detectMusicIntent('pon FES de Víctor Mendívil');
  assert.equal(result?.title, 'FES');
  assert.equal(result?.artist, 'Víctor Mendívil');
});

test('no responde a una mención musical casual sin intención', () => {
  assert.equal(detectMusicIntent('Ayer escuché una canción muy buena'), null);
});

test('parsea .play con título y artista separados por guion', () => {
  assert.deepEqual(parsePlayCommand('.play FES - Víctor Mendívil'), {
    title: 'FES', artist: 'Víctor Mendívil', sourceText: '.play FES - Víctor Mendívil'
  });
});

test('permite el activador NORE antes de .play en grupos', () => {
  const result = parsePlayCommand('NORE, .play Mi canción - Mi artista');
  assert.equal(result?.title, 'Mi canción');
  assert.equal(result?.artist, 'Mi artista');
});

test('rechaza .play sin artista o sin separador claro', () => {
  assert.equal(parsePlayCommand('.play FES'), null);
  assert.equal(parsePlayCommand('.play - Víctor Mendívil'), null);
});
