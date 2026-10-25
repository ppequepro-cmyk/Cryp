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
  const hasTriggerWord = /\bnore\b/i.test(text);
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
    '✦ *NORE · CENTRO DE AYUDA*',
    '',
    '🧠 *CHAT PRIVADO*',
    'Escríbeme normalmente. Puedo responder preguntas, explicar temas y analizar imágenes.',
    '',
    '👥 *GRUPOS*',
    'Todos los comandos también requieren escribir NORE o etiquetar mi cuenta. No respondo a menciones de “IA” o “bot”.',
    '',
    '🎵 *MÚSICA*',
    '• .play título - artista  Buscar una grabación autorizada y enviarla si está disponible.',
    '• !musica  Abrir NORE MUSIC.',
    '',
    '📄 *DOCUMENTOS Y ESTUDIO*',
    '• .pdf texto  Crear un documento PDF.',
    '• Enviar un PDF  Extraer texto para resumirlo o explicarlo. Los PDF escaneados pueden necesitar OCR.',
    '',
    '🗓️ *SALÓN*',
    '• !horario  Consultar el horario si ya fue configurado.',
    '• !tareas  Consultar tareas registradas.',
    '• !recordar  Consultar el estado del módulo de recordatorios.',
    '',
    '👑 *INFORMACIÓN Y ADMINISTRACIÓN*',
    '• !creador  Información del creador.',
    '• !stats  Estadísticas básicas (solo creador).',
    '',
    '🌐 *MENÚ*',
    '• !menu  Abrir la página de NORE.',
    '• !ayuda  Mostrar esta guía.',
    '',
    'Algunas funciones de administración, moderación y stickers siguen en desarrollo. No las presentaré como activas hasta que estén conectadas y probadas.'
  ].join('\\n');
}
