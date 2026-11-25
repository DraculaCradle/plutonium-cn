import legacyReferences from './UuidLegacyReferencesCn.mjs';

// The cn.5 writer emitted variable-width UTF-16 hex, while its reader consumed
// two digits at a time. Keep ASCII UUIDs stable and escape non-ASCII JSON first.
export function encodeFauxUuidPayloadCn({tag, text}) {
  const json = JSON.stringify({tag, text}).replace(/[\u007f-\uffff]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return Array.from(json, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

let legacyIndex;
function getLegacyIndex() {
  if (legacyIndex) return legacyIndex;
  legacyIndex = new Map();
  for (const [tag, text] of legacyReferences) {
    const json = JSON.stringify({tag, text});
    let key = '';
    for (let i = 0; i < json.length; ++i) key += json.charCodeAt(i).toString(16);
    // Ambiguous historical encodings must never select an arbitrary document.
    if (legacyIndex.has(key)) {
      const previous = legacyIndex.get(key);
      if (!previous || previous.tag !== tag || previous.text !== text) legacyIndex.set(key, null);
    } else legacyIndex.set(key, {tag, text});
  }
  return legacyIndex;
}

const warned = new Set();
function invalid(serialized) {
  const key = String(serialized);
  if (!warned.has(key) && warned.size < 100) {
    warned.add(key);
    console.warn('Plutonium CN | 无法解析旧法术/文档引用，请重新绑定对应活动的引用。', key.slice(0, 100));
  }
  return null;
}

export function decodeFauxUuidPayloadCn(serialized, {docType = null} = {}) {
  if (typeof serialized !== 'string' || !/^[0-9a-f]+$/i.test(serialized)) return invalid(serialized);
  const key = serialized.toLowerCase();
  // Look up complete original encodings before byte decoding: some broken
  // encodings parse as JSON successfully but contain the wrong document name.
  const index = getLegacyIndex();
  if (index.has(key)) {
    const known = index.get(key);
    return known ? {...known, docType} : invalid(serialized);
  }
  if (key.length % 2) return invalid(serialized);
  try {
    let json = '';
    for (let i = 0; i < key.length; i += 2) json += String.fromCharCode(parseInt(key.slice(i, i + 2), 16));
    const parsed = JSON.parse(json);
    if (!parsed || Array.isArray(parsed) || typeof parsed.tag !== 'string' || !parsed.tag
      || typeof parsed.text !== 'string' || !parsed.text) return invalid(serialized);
    return {tag: parsed.tag, text: parsed.text, docType};
  } catch {
    return invalid(serialized);
  }
}
