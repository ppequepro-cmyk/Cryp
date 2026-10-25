import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config, isOwner } from './src/config.js';
import { askAI } from './src/ai.js';
import { getText, isGroup, isCreatorQuestion, isBotMentioned, creatorCard, helpMessage } from './src/messages.js';

const logger = pino({ level: 'silent' });
const cooldowns = new Map();
const stats = { received: 0, answered: 0, startedAt: Date.now() };

function allowedByCooldown(sender) {
  const now = Date.now();
  const last = cooldowns.get(sender) || 0;
  if (now - last < 3500) return false;
  cooldowns.set(sender, now);
  return true;
}

async function sendText(sock, jid, msg, text) {
  await sock.sendMessage(jid, { text }, { quoted: msg });
}

async function handleCommand(sock, jid, msg, text, sender, owner) {
  const command = text.trim().toLowerCase();

  if (command === '!ayuda') {
    await sendText(sock, jid, msg, helpMessage());
    return true;
  }
  if (command === '!menu' || command === 'menu') {
    await sendText(sock, jid, msg, `🌐 Menú de NORE: ${config.menuUrl}`);
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
    await sendText(sock, jid, msg, '⏰ La función para guardar y enviar recordatorios todavía está en desarrollo. No quiero fingir que guardé algo cuando aún no puedo hacerlo.');
    return true;
  }
  if (owner && command === '!stats') {
    const uptime = Math.floor((Date.now() - stats.startedAt) / 1000);
    await sendText(sock, jid, msg, `📊 *NORE*\nMensajes recibidos: ${stats.received}\nRespuestas: ${stats.answered}\nActivo: ${uptime}s`);
    return true;
  }
  return false;
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: ['NORE', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);
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
      } else {
        console.log('Sesión cerrada. Borra auth_info solo si quieres vincular otra cuenta.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;
      const imageMessage = msg.message.imageMessage;
      const hasImage = Boolean(imageMessage);
      const text = getText(msg) || (hasImage ? 'Analiza esta imagen y ayúdame a entenderla.' : '');
      if (!text && !hasImage) continue;
      stats.received++;

      const group = isGroup(jid);
      const sender = group ? msg.key.participant : jid;
      const owner = isOwner(sender);

      if (await handleCommand(sock, jid, msg, text, sender, owner)) continue;

      // Privado: conversación libre. Grupo: solo responde si lo llaman.
      if (group && !isBotMentioned(msg, text, sock.user?.id)) continue;
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
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
            logger,
            reuploadRequest: sock.updateMediaMessage
          });
          if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            throw new Error('No se pudo descargar la imagen de WhatsApp');
          }
          if (buffer.length > 20 * 1024 * 1024) {
            await sendText(sock, jid, msg, 'La imagen supera el límite de 20 MB que admite el servicio de análisis visual.');
            continue;
          }
          const mimeType = String(imageMessage.mimetype || 'image/jpeg').split(';')[0];
          if (!mimeType.startsWith('image/')) {
            throw new Error('El archivo recibido no tiene un formato de imagen válido');
          }
          image = { mimeType, base64: buffer.toString('base64') };
        }
        const answer = await askAI(sender || jid, text, name, image);
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
