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
  return /\b(creador|dueñ[oa]|owner)\b/i.test(text);
}

export function isBotMentioned(message = {}, text = '', botJid = '') {
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const normalizedBot = String(botJid).split(':')[0];
  const hasMention = mentioned.some(jid => String(jid).split(':')[0] === normalizedBot);
  return hasMention || /\b(nore|ia|bot)\b/i.test(text);
}

export function creatorCard() {
  return [
    '👑 *CREADOR DE NORE*',
    'Nombre: Emmanuel',
    'WhatsApp: wa.me/' + (config.ownerNumber || '13202109768'),
    'Instagram: https://www.instagram.com/gw_emma/',
    '',
    'NORE está en su versión básica y continúa en desarrollo.'
  ].join('\n');
}
