const FRAMES = [
  { mark: '🟥', label: 'ACCESS' },
  { mark: '🟦', label: 'SYSTEM' },
  { mark: '🟩', label: 'ONLINE' },
  { mark: '🟪', label: 'NORE' }
];
const active = new Set();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function parseHackerCommand(text = '') {
  const match = String(text).trim().match(/^\.hacker\s+([\s\S]+)$/i);
  if (!match) return null;
  const value = match[1].trim();
  return value && value.length <= 300 ? value : null;
}

export async function runHackerEffect(sock, jid, msg, value) {
  if (active.has(jid)) {
    await sock.sendMessage(jid, { text: '⌛ El efecto hacker ya está activo en este chat.' }, { quoted: msg });
    return false;
  }
  active.add(jid);
  try {
    const sent = await sock.sendMessage(jid, { text: '▰ NORE // INITIALIZING' }, { quoted: msg });
    if (!sent?.key) throw new Error('No se recibió la clave del mensaje.');
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const frame of FRAMES) {
        await wait(500);
        await sock.sendMessage(jid, { text: `${frame.mark} ${frame.label} // ${value}`, edit: sent.key });
      }
    }
    await sock.sendMessage(jid, { text: `🟩 NORE // ${value}`, edit: sent.key });
    return true;
  } catch (error) {
    console.error('Error en efecto hacker:', error.message);
    try { await sock.sendMessage(jid, { text: 'No pude editar el mensaje para completar el efecto.' }, { quoted: msg }); } catch {}
    return false;
  } finally { active.delete(jid); }
}
