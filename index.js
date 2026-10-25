import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config, isOwner } from './src/config.js';
import { askAI } from './src/ai.js';
import { detectMusicIntent, parsePlayCommand, getMusicReply } from './src/music.js';
import { createPdfBuffer, readPdf } from './src/pdf.js';
import { getText, isGroup, isCreatorQuestion, isBotMentioned, creatorCard, helpMessage } from './src/messages.js';

const logger = pino({ level: 'silent' });
const cooldowns = new Map();
const musicCooldowns = new Map();
const stats = { received: 0, answered: 0, startedAt: Date.now() };

function allowedByCooldown(sender) {
  const now = Date.now();
  const last = cooldowns.get(sender) || 0;
  if (now - last < 3500) return false;
  cooldowns.set(sender, now);
  return true;
}

function allowMusicReply(jid, title, artist) {
  const key = jid + ':' + title.toLowerCase() + ':' + artist.toLowerCase();
  const now = Date.now();
  const last = musicCooldowns.get(key) || 0;
  if (now - last < 10 * 60 * 1000) return false;
  musicCooldowns.set(key, now);
  return true;
}

async function sendText(sock, jid, msg, text) {
  await sock.sendMessage(jid, { text }, { quoted: msg });
}

async function handleGroupMusic(sock, jid, msg, text) {
  const intent = detectMusicIntent(text);
  if (!intent || !allowMusicReply(jid, intent.title, intent.artist)) return false;
  try {
    await sock.sendMessage(jid, { react: { text: '🎵', key: msg.key } });
    const result = await getMusicReply(intent);
    await sendText(sock, jid, msg, result.text);
    if (result.audio) await sock.sendMessage(jid, result.audio, { quoted: msg });
  } catch (error) {
    console.error('Error en NORE MUSIC:', error.message);
    await sendText(sock, jid, msg, '🎵 Identifiqué la canción, pero no pude obtener una grabación autorizada ahora mismo.');
  }
  return true;
}

async function handleCommand(sock, jid, msg, text, sender, owner) {
  const command = text.trim().toLowerCase();
  const play = parsePlayCommand(text);
  if (play) {
    try {
      if (!allowMusicReply(jid, play.title, play.artist)) {
        await sendText(sock, jid, msg, '⏳ Esa búsqueda ya se procesó hace poco. Espera unos minutos antes de repetirla.');
        return true;
      }
      await sock.sendMessage(jid, { react: { text: '🎵', key: msg.key } });
      const result = await getMusicReply(play);
      await sendText(sock, jid, msg, result.text);
      if (result.audio) await sock.sendMessage(jid, result.audio, { quoted: msg });
    } catch (error) {
      console.error('Error en .play:', error.message);
      await sendText(sock, jid, msg, 'No pude completar la búsqueda musical. Inténtalo más tarde; no enviaré audio si no puedo verificar una fuente compatible.');
    }
    return true;
  }
  if (command === '.pdf' || command.startsWith('.pdf ')) {
    const content = text.trim().slice(4).trim();
    if (!content) {
      await sendText(sock, jid, msg, '📄 Para crear un PDF escribe .pdf seguido del texto que quieres incluir. También puedes enviarme un archivo PDF y lo leeré para resumirlo o explicarlo.');
      return true;
    }
    try {
      const buffer = await createPdfBuffer('Documento creado por NORE', content);
      await sock.sendMessage(jid, { document: buffer, mimetype: 'application/pdf', fileName: 'documento-nore.pdf', caption: '📄 Tu PDF está listo.' }, { quoted: msg });
    } catch (error) {
      await sendText(sock, jid, msg, 'No pude crear el PDF: ' + error.message);
    }
    return true;
  }
  if (command === '!ayuda') {
    await sendText(sock, jid, msg, helpMessage());
    return true;
  }
  if (command === '!menu' || command === 'menu') {
    await sendText(sock, jid, msg, `🌐 Menú de NORE: ${config.menuUrl}`);
    return true;
  }
  if (command === '!musica' || command.startsWith('!musica ')) {
    const query = text.trim().slice('!musica'.length).trim();
    const musicUrl = new URL(config.musicUrl);
    if (query) musicUrl.searchParams.set('q', query);
    await sendText(sock, jid, msg, ['🎵 *NORE MUSIC*', query ? `Búsqueda: ${query}` : 'Busca una canción en el catálogo autorizado.', musicUrl.toString()].join('\n'));
    return true;
  }
  if (command === '!creador' || isCreatorQuestion(text)) {
    await sendText(sock, jid, msg, creatorCard());
    return true;
  }
  if (command === '!horario') {
    await sendText(sock, jid, msg, '🗓️ Todavía no hay un horario del salón configurado. Cuando se cargue, podrás consultarlo aquí.');
    return true;
  }
  if (command === '!tareas') {
    await sendText(sock, jid, msg, '📚 Todavía no hay tareas registradas. Cuando se active el registro del salón, aquí aparecerán las pendientes.');
    return true;
  }
  if (command === '!recordar') {
    await sendText(sock, jid, msg, '⏰ La función para guardar y enviar recordatorios todavía está en desarrollo.');
    return true;
  }
  if (owner && command === '!stats') {
    const uptime = Math.floor((Date.now() - stats.startedAt) / 1000);
    await sendText(sock, jid, msg, `📊 *NORE*\nMensajes recibidos: ${stats.received}\nRespuestas: ${stats.answered}\nActivo: ${uptime}s`);
    return true;
  }
  return false;
}

async function welcomeParticipants(sock, groupJid, participants = []) {
  for (const participant of participants) {
    try {
      let name = 'nuevo integrante';
      try {
        const metadata = await sock.groupMetadata(groupJid);
        const member = metadata.participants.find(item => item.id === participant);
        if (member?.notify) name = member.notify;
      } catch {}
      const caption = `🎉 ¡Bienvenido/a a este grupo, ${name}!\n\nSoy NORE. Para llamarme, escribe NORE en tu mensaje o etiqueta mi cuenta. Usa !ayuda para conocer lo que puedo hacer.\n\n¡Que tengas una buena estancia! 💜`;
      try {
        const photoUrl = await sock.profilePictureUrl(participant, 'image');
        const response = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('No se pudo obtener la foto de perfil');
        const photo = Buffer.from(await response.arrayBuffer());
        if (!photo.length || photo.length > 5 * 1024 * 1024) throw new Error('Foto no disponible o demasiado grande');
        await sock.sendMessage(groupJid, { image: photo, caption, mentions: [participant] });
      } catch {
        await sock.sendMessage(groupJid, { text: `🎉 ¡Bienvenido/a @${participant.split('@')[0]}!\n\nSoy NORE. Escribe NORE o etiquétame para llamarme. Usa !ayuda para conocer mis funciones. 💜`, mentions: [participant] });
      }
    } catch (error) {
      console.error('No se pudo enviar la bienvenida:', error.message);
    }
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version, auth: state, logger,
    browser: ['NORE', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('group-participants.update', async update => {
    if (update.action === 'add') await welcomeParticipants(sock, update.id, update.participants);
  });
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('Escanea este QR desde WhatsApp > Dispositivos vinculados:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('NORE conectado a WhatsApp.');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('Conexión cerrada. Reintentando...');
        setTimeout(start, 3000);
      } else console.log('Sesión cerrada. Borra auth_info solo si quieres vincular otra cuenta.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;
      const imageMessage = msg.message.imageMessage;
      const documentMessage = msg.message.documentMessage;
      const hasImage = Boolean(imageMessage);
      const isPdf = Boolean(documentMessage && (documentMessage.mimetype === 'application/pdf' || String(documentMessage.fileName || '').toLowerCase().endsWith('.pdf')));
      const text = getText(msg) || (hasImage ? 'Analiza esta imagen y ayúdame a entenderla.' : '') || (isPdf ? 'Lee este PDF y dame un resumen claro, identifica sus temas principales y responde según su contenido.' : '');
      if (!text && !hasImage && !isPdf) continue;
      stats.received++;

      const group = isGroup(jid);
      const sender = group ? msg.key.participant : jid;
      const owner = isOwner(sender);

      // En grupos, incluso los comandos requieren la palabra NORE o una mención real.
      if (group && !isBotMentioned(msg, text, sock.user?.id)) continue;
      if (await handleCommand(sock, jid, msg, text, sender, owner)) continue;
      // La búsqueda contextual de música tampoco debe saltarse el activador del grupo.
      if (group && await handleGroupMusic(sock, jid, msg, text)) continue;
      if (!allowedByCooldown(sender || jid)) continue;

      try {
        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
        const name = msg.pushName || 'Compañero';
        let image = null;
        if (hasImage) {
          const declaredSize = Number(imageMessage.fileLength || 0);
          if (declaredSize > 20 * 1024 * 1024) {
            await sendText(sock, jid, msg, 'La imagen supera el límite de 20 MB que admite el servicio de análisis visual.');
            continue;
          }
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
          if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('No se pudo descargar la imagen de WhatsApp');
          if (buffer.length > 20 * 1024 * 1024) {
            await sendText(sock, jid, msg, 'La imagen supera el límite de 20 MB que admite el servicio de análisis visual.');
            continue;
          }
          const mimeType = String(imageMessage.mimetype || 'image/jpeg').split(';')[0];
          if (!mimeType.startsWith('image/')) throw new Error('El archivo recibido no tiene un formato de imagen válido');
          image = { mimeType, base64: buffer.toString('base64') };
        }
        let prompt = text;
        if (isPdf) {
          const declaredSize = Number(documentMessage.fileLength || 0);
          if (declaredSize > 10 * 1024 * 1024) {
            await sendText(sock, jid, msg, 'El PDF supera el límite de 10 MB.');
            continue;
          }
          const pdfBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
          const extractedText = await readPdf(pdfBuffer);
          prompt = `${text}\n\nContenido extraído del PDF:\n${extractedText}`;
        }
        const answer = await askAI(sender || jid, prompt, name, image);
        await sendText(sock, jid, msg, answer);
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        stats.answered++;
      } catch (error) {
        console.error('Error al responder:', error.message);
        await sendText(sock, jid, msg, 'No pude completar eso ahora. Inténtalo de nuevo más tarde.');
      }
    }
  });
}

start().catch(error => {
  console.error('No se pudo iniciar NORE:', error);
  process.exitCode = 1;
});
