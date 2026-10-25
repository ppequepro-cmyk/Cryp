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
    '👋 *¡Bienvenido al recorrido de NORE!*',
    '',
    '🧠 *1. La IA en privado*',
    'Escríbeme normalmente. Puedes conversar, preguntar, estudiar, pedir explicaciones y enviar fotos de ejercicios. No necesitas comandos.',
    '',
    '👥 *2. NORE en grupos*',
    'Para llamarme, escribe NORE en tu mensaje o etiqueta mi cuenta. No interrumpo las conversaciones por mi cuenta.',
    '',
    '📚 *3. Apoyo escolar*',
    'Puedo explicar temas, ordenar procedimientos, resolver ejercicios paso a paso y analizar imágenes legibles. Si algo no se distingue, te lo diré.',
    '',
    '📄 *4. Crear y leer PDF*',
    'Escribe .pdf seguido del texto para crear un documento. También puedes enviarme un PDF para que extraiga su texto y te ayude a resumirlo o explicarlo. Los PDF escaneados pueden requerir OCR.',
    '',
    '🎵 *5. Música*',
    'Usa !musica para abrir NORE MUSIC y buscar canciones con fuentes autorizadas.',
    '',
    '🗓️ *6. Herramientas del salón*',
    '!horario y !tareas muestran la información configurada. Si aún no está cargada, te lo diré.',
    '',
    '👑 *7. Información*',
    '!creador muestra quién creó NORE. !menu abre el menú web.',
    '',
    '🧭 *Comandos disponibles*',
    '• !ayuda  Ver este recorrido',
    '• !menu  Abrir el menú web',
    '• .pdf texto  Crear un documento PDF',
    '• Enviar un PDF  Leer, resumir y explicar su contenido',
    '• !musica  Abrir NORE MUSIC',
    '• !horario  Consultar el horario configurado',
    '• !tareas  Consultar tareas registradas',
    '• !creador  Información del creador',
    '',
    '✨ NORE está en desarrollo. Te indicaré con honestidad qué funciones están activas y cuáles todavía no.'
  ].join('\n');
}
