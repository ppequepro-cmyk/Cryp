export function parsePrivCommand(text = '') {
  const match = String(text).trim().match(/^\.(?:priv|privacidad|viewonce)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  return (match[1] || '').trim();
}

export async function sendViewOnce(sock, jid, msg, text, downloadMediaMessage) {
  const context = msg?.message?.extendedTextMessage?.contextInfo
    || msg?.message?.imageMessage?.contextInfo
    || {};
  const quotedMessage = context.quotedMessage || null;
  const quotedImage = quotedMessage?.imageMessage || null;

  if (quotedImage) {
    const quoted = {
      key: {
        remoteJid: jid,
        id: context.stanzaId,
        participant: context.participant,
        fromMe: false
      },
      message: quotedMessage
    };
    const image = await downloadMediaMessage(quoted, 'buffer', {});
    if (!Buffer.isBuffer(image) || image.length === 0) {
      throw new Error('No se pudo descargar la imagen citada.');
    }
    await sock.sendMessage(jid, {
      image,
      ...(text ? { caption: text } : {}),
      viewOnce: true
    }, { quoted: msg });
    return 'image';
  }

  if (!text) return null;
  await sock.sendMessage(jid, { text, viewOnce: true }, { quoted: msg });
  return 'text';
}
