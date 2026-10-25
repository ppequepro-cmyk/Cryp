import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config, isOwner } from './src/config.js';
import { askAI } from './src/ai.js';
import { getText, isGroup, isCreatorQuestion, isBotMentioned, creatorCard } from './src/messages.js';

const logger = pino({ level: 'silent' });
const cooldowns = new Map();
const stats = { received: 0, answered: 0, startedAt: Date.now() };

function allowedByCooldown(jid) {
  const now = Date.now();
  const last = cooldowns.get(jid) || 0;
  if (now - last < 3500) return false;
  cooldowns.set(jid, now);
  return true;
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
      const text = getText(msg);
      if (!text) continue;
      stats.received++;

      const group = isGroup(jid);
      const sender = group ? msg.key.participant : jid;
      const owner = isOwner(sender);

      if (isCreatorQuestion(text) || /^!creador$/i.test(text)) {
        await sock.sendMessage(jid, { text: creatorCard() }, { quoted: msg });
        stats.answered++;
        continue;
      }

      // Owner-only starter admin commands. Group-wide announcement requires owner.
      if (owner && /^!stats$/i.test(text)) {
        const uptime = Math.floor((Date.now() - stats.startedAt) / 1000);
        await sock.sendMessage(jid, { text: `📊 *NORE*\\nMensajes recibidos: ${stats.received}\\nRespuestas: ${stats.answered}\\nActivo: ${uptime}s` }, { quoted: msg });
        continue;
      }
      if (owner && /^!menu$/i.test(text)) {
        await sock.sendMessage(jid, { text: `🌐 Menú de NORE: ${config.menuUrl}` }, { quoted: msg });
        continue;
      }

      // Private chat is free-form. Groups require a trigger or a mention.
      if (group && !isBotMentioned(msg, text)) continue;
      if (!allowedByCooldown(sender || jid)) continue;

      try {
        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
        const name = msg.pushName || 'Usuario';
        const answer = await askAI(sender || jid, text, name);
        await sock.sendMessage(jid, { text: answer }, { quoted: msg });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        stats.answered++;
      } catch (error) {
        console.error('Error al responder:', error.message);
        await sock.sendMessage(jid, { text: 'No pude completar eso ahora. Inténtalo de nuevo más tarde.' }, { quoted: msg });
      }
    }
  });
}

start().catch(error => {
  console.error('No se pudo iniciar NORE:', error);
  process.exitCode = 1;
});
