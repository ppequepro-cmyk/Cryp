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
  const normalize = jid => String(jid).replace(/:\d+@/, '@');
  const normalizedBot = normalize(botJid);
  const hasMention = Boolean(botJid) && mentioned.some(jid => normalize(jid) === normalizedBot);
  const hasTriggerWord = /\b(nore|ia|bot)\b/i.test(text);
  return hasMention || hasTriggerWord;
}

export function creatorCard() {
  return [
    '👑 *CREADOR DE NORE*',
    'Nombre: Emmanuel',
    'WhatsApp: wa.me/' + (config.ownerNumber || '13202109768'),
    'Instagram: https://www.instagram.com/emma.l.121?rpxt=ZHpwaTF1emZ5MDQ5',
    '',
    'NORE está en su versión básica y continúa en desarrollo.'
  ].join('\n');
}

export function helpMessage() {
  return [
    '📚 *NORE · AYUDA DEL SALÓN*',
    '',
    'Puedes escribirme normalmente para resolver dudas, estudiar o pedir explicaciones.',
    '',
    '*Comandos principales*',
    '• !menu  Ver el menú de NORE',
    '• !musica  Buscar y reproducir música',
    '• !horario  Consultar el horario del salón',
    '• !tareas  Consultar tareas pendientes',
    '• !recordar  Información sobre recordatorios',
    '• !creador  Ver información del creador',
    '• !ayuda  Mostrar esta ayuda',
    '',
    'En grupos, escribe NORE, IA o bot en tu mensaje, o etiqueta la cuenta para llamar mi atención.'
  ].join('\n');
}
