const COLORS = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪'];
const activeChats = new Set();

export function parseRgbCommand(text = '') {
  const match = String(text).trim().match(/^(?:\.rgb1|\.rgb|\.arcoiris)\s+([\s\S]+)$/i);
  if (!match) return null;
  const value = match[1].trim();
  if (!value || value.length > 500) return null;
  return value;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runRgbAnimation(sock, jid, msg, value) {
  if (activeChats.has(jid)) {
    await sock.sendMessage(jid, { text: '🌈 Ya hay una animación RGB en este chat. Espera a que termine.' }, { quoted: msg });
    return false;
  }
  if (!msg?.key || !jid || !value) return false;

  activeChats.add(jid);
  try {
    const sent = await sock.sendMessage(jid, { text: value }, { quoted: msg });
    if (!sent?.key) throw new Error('WhatsApp no devolvió la clave del mensaje inicial.');

    for (let cycle = 0; cycle < 3; cycle++) {
      for (const color of COLORS) {
        await wait(400);
        await sock.sendMessage(jid, {
          text: `${color} ${value}`,
          edit: sent.key
        });
      }
    }
    return true;
  } catch (error) {
    console.error('No se pudo completar la animación RGB:', error.message);
    try {
      await sock.sendMessage(jid, {
        text: '⚠️ WhatsApp no permitió editar el mensaje para completar el efecto RGB. No enviaré mensajes repetidos.'
      }, { quoted: msg });
    } catch {}
    return false;
  } finally {
    activeChats.delete(jid);
  }
}
