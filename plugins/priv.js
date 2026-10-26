function unwrapMessage(message = {}) {
  let current = message;
  for (let i = 0; i < 4 && current; i++) {
    if (current.imageMessage) return current;
    current = current.ephemeralMessage?.message
      || current.viewOnceMessage?.message
      || current.viewOnceMessageV2?.message
      || current.viewOnceMessageV2Extension?.message
      || current.documentWithCaptionMessage?.message
      || null;
  }
  return null;
}

export function parsePrivCommand(text = '') {
  const match = String(text).trim().match(/^\.(?:priv|privacidad|viewonce)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  return (match[1] || '').trim();
}

export async function sendViewOnce(sock, jid, msg, text, downloadMediaMessage) {
  const context = msg?.message?.extendedTextMessage?.contextInfo
    || msg?.message?.imageMessage?.contextInfo
    || msg?.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo
    || {};
  const quotedMessage = context.quotedMessage || null;
  const unwrapped = unwrapMessage(quotedMessage);
  const quotedImage = unwrapped?.imageMessage || null;

  if (quotedImage) {
    if (!context.stanzaId) throw new Error('No encontré el identificador de la imagen citada.');
    const quoted = {
      key: {
        remoteJid: jid,
        id: context.stanzaId,
        participant: context.participant,
        fromMe: false
      },
      message: unwrapped
    };
    const image = await downloadMediaMessage(quoted, 'buffer', {});
    if (!Buffer.isBuffer(image) || image.length === 0) throw new Error('No se pudo descargar la imagen citada.');
    await sock.sendMessage(jid, { image, ...(text ? { caption: text } : {}), viewOnce: true }, { quoted: msg });
    return 'image';
  }
  if (!text) return null;
  await sock.sendMessage(jid, { text, viewOnce: true }, { quoted: msg });
  return 'text';
}
