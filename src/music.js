const MUSIC_API = 'https://nore-music-api.ppequepro.workers.dev';

const praisePattern = /\b(est[aá]\s+(?:muy\s+)?(?:buena|buen[ií]sima|chida|perrona|incre[ií]ble)|me\s+gusta|est[aá]\s+sonando|qu[eé]\s+buena\s+canci[oó]n)\b/i;
const requestPattern = /\b(?:pon(?:me)?|reproduce|reproducir|manda(?:me)?|env[ií]a(?:me)?|pasa(?:me)?|busca(?:me)?|quiero\s+escuchar)\b/i;
const mentionPattern = /\b(?:canci[oó]n|rola|tema\s+musical)\b/i;

export function normalizeMusicText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function detectMusicIntent(text = '') {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 500 || (!mentionPattern.test(clean) && !requestPattern.test(clean))) return null;
  if (!praisePattern.test(clean) && !requestPattern.test(clean)) return null;

  const withArtist = clean.match(/(?:canci[oó]n|rola|tema)\s+(?:de\s+)?(.+?)\s+de\s+([\p{L}\p{N}][\p{L}\p{N} .'-]{1,70}?)(?=\s+(?:est[aá]|me\s+gusta|pon|manda|env[ií]a|pasa|$))/iu);
  if (withArtist) {
    const title = withArtist[1].replace(/[“”"'.,!?]+$/g, '').trim();
    const artist = withArtist[2].replace(/[“”"'.,!?]+$/g, '').trim();
    if (title.length >= 2 && artist.length >= 3) return { title, artist, sourceText: clean };
  }

  const shortRequest = clean.match(/\b(?:pon(?:me)?|reproduce|manda(?:me)?|env[ií]a(?:me)?|pasa(?:me)?|busca(?:me)?|quiero\s+escuchar)\s+(?:la\s+canci[oó]n\s+)?(.+?)\s+de\s+([\p{L}\p{N}][\p{L}\p{N} .'-]{1,70})\s*$/iu);
  if (shortRequest) return {
    title: shortRequest[1].replace(/[“”"'.,!?]+$/g, '').trim(),
    artist: shortRequest[2].replace(/[“”"'.,!?]+$/g, '').trim(),
    sourceText: clean
  };
  return null;
}

async function fetchJson(url, timeoutMs = 10000) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}

async function artistDetails(artist) {
  const params = new URLSearchParams({ query: artist, fmt: 'json', limit: '1' });
  try {
    const data = await fetchJson('https://musicbrainz.org/ws/2/artist/?' + params, 7000);
    const found = data.artists?.[0];
    if (!found) return null;
    return {
      name: found.name || artist,
      country: found.country || '',
      type: found.type || '',
      disambiguation: found.disambiguation || ''
    };
  } catch {
    return null;
  }
}

export async function findLicensedTrack({ title, artist }) {
  const searchUrl = new URL('/search', MUSIC_API);
  searchUrl.searchParams.set('q', (title + ' ' + artist).slice(0, 100));
  const result = await fetchJson(searchUrl);
  const tracks = Array.isArray(result.tracks) ? result.tracks : [];
  const wantedTitle = normalizeMusicText(title);
  const wantedArtist = normalizeMusicText(artist);
  const ranked = tracks.map(track => {
    const gotTitle = normalizeMusicText(track.title);
    const gotArtist = normalizeMusicText(track.artist);
    const titleMatch = gotTitle.includes(wantedTitle) || wantedTitle.includes(gotTitle);
    const artistMatch = gotArtist.includes(wantedArtist) || wantedArtist.includes(gotArtist);
    return { track, score: (titleMatch ? 2 : 0) + (artistMatch ? 2 : 0) };
  }).filter(item => item.score >= 3).sort((a, b) => b.score - a.score);
  return ranked[0]?.track || null;
}

export async function getMusicReply({ title, artist }) {
  const [track, details] = await Promise.all([
    findLicensedTrack({ title, artist }).catch(() => null),
    artistDetails(artist)
  ]);
  const lines = [
    '🎵 *NORE MUSIC*',
    '🎶 Canción: *' + title + '*',
    '🎤 Artista: *' + (details?.name || artist) + '*'
  ];
  if (details?.country) lines.push('🌎 País: ' + details.country);
  if (details?.type) lines.push('🎙️ Tipo: ' + details.type);
  if (details?.disambiguation) lines.push('ℹ️ ' + details.disambiguation);

  if (!track) {
    lines.push('', 'No encontré una grabación con licencia compatible para enviarla como archivo.');
    lines.push('🔗 Buscar en NORE MUSIC: https://ppequepro-cmyk.github.io/Cryp/music.html?q=' + encodeURIComponent(title + ' ' + artist));
    return { text: lines.join('\n'), audio: null };
  }

  const streamUrl = new URL('/stream/' + encodeURIComponent(track.id), MUSIC_API);
  const resolved = await fetchJson(streamUrl);
  if (!resolved.url || !/^https:\/\//i.test(resolved.url)) throw new Error('La fuente no devolvió una URL de audio válida');

  const audioResponse = await fetch(resolved.url, { signal: AbortSignal.timeout(20000) });
  if (!audioResponse.ok) throw new Error('No se pudo descargar el audio: HTTP ' + audioResponse.status);
  const declaredLength = Number(audioResponse.headers.get('content-length') || 0);
  if (declaredLength > 15 * 1024 * 1024) {
    lines.push('', 'Encontré una grabación autorizada, pero supera el límite para enviarla aquí.');
    lines.push('🔗 ' + (track.trackUrl || 'https://archive.org/details/' + encodeURIComponent(track.id)));
    return { text: lines.join('\n'), audio: null };
  }
  const arrayBuffer = await audioResponse.arrayBuffer();
  if (!arrayBuffer.byteLength || arrayBuffer.byteLength > 15 * 1024 * 1024) {
    lines.push('', 'La grabación no se puede enviar como archivo por su tamaño.');
    lines.push('🔗 ' + (track.trackUrl || 'https://archive.org/details/' + encodeURIComponent(track.id)));
    return { text: lines.join('\n'), audio: null };
  }
  lines.push('', '✅ Grabación con licencia compatible encontrada.');
  return {
    text: lines.join('\n'),
    audio: {
      audio: Buffer.from(arrayBuffer),
      mimetype: resolved.format === 'ogg' ? 'audio/ogg' : resolved.format === 'wav' ? 'audio/wav' : resolved.format === 'flac' ? 'audio/flac' : 'audio/mpeg',
      ptt: false
    }
  };
}
