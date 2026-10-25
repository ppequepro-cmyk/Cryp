import { config } from './config.js';

export function getText(message = {}) {
  const m = message.message || {};
  return (m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || m.documentMessage?.caption
    || '').trim();
}

export function isGroup(jid = '') {
  return jid.endsWith('@g.us');
}

export function isCreatorQuestion(text = '') {
  return /\\b(creador|dueñ[oa]|owner)\\b/i.test(text);
}

export function isBotMentioned(message = {}, text = '') {
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const botJid = message.key?.participant;
  return mentioned.includes(botJid) || /\\b(nore|ia|bot)\\b/i.test(text);
}

export function creatorCard() {
  return [
    '👑 *CREADOR DE NORE*',
    'Nombre: Emmanuel',
    'WhatsApp: wa.me/' + (config.ownerNumber || 'No configurado'),
    'Instagram: https://www.instagram.com/gw_emma/',
    '',
    'NORE está en su versión básica y continúa en desarrollo.'
  ].join('\\n');
}
