import test from 'node:test';
import assert from 'node:assert/strict';
import { getText, isGroup, isBotMentioned, isCreatorQuestion, helpMessage } from '../src/messages.js';

test('extrae texto y caption de mensajes', () => {
  assert.equal(getText({ message: { conversation: ' Hola ' } }), 'Hola');
  assert.equal(getText({ message: { imageMessage: { caption: '  revisa esto  ' } } }), 'revisa esto');
});

test('identifica grupos', () => {
  assert.equal(isGroup('123@g.us'), true);
  assert.equal(isGroup('123@s.whatsapp.net'), false);
});

test('en grupos activa solo con NORE o mención real', () => {
  assert.equal(isBotMentioned({}, 'NORE, ayúdame'), true);
  assert.equal(isBotMentioned({}, 'IA explícame esto'), false);
  assert.equal(isBotMentioned({}, 'bot ayúdame'), false);
  assert.equal(isBotMentioned({}, 'historia de México'), false);
  assert.equal(isBotMentioned({ message: { extendedTextMessage: { contextInfo: { mentionedJid: ['999:4@s.whatsapp.net'] } } } }, 'ayuda', '999@s.whatsapp.net'), true);
});

test('detecta preguntas sobre el creador', () => {
  assert.equal(isCreatorQuestion('¿Quién es el creador?'), true);
  assert.equal(isCreatorQuestion('Explícame la fotosíntesis'), false);
});

test('la ayuda explica chat privado, activación en grupos y funciones', () => {
  const help = helpMessage();
  assert.match(help, /privado/i);
  assert.match(help, /escribe NORE/i);
  assert.match(help, /!musica/);
});
