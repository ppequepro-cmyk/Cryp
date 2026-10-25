import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMusicIntent } from '../src/music.js';

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
