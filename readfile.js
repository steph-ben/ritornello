// Lecture du contenu d'un fichier choisi par l'utilisateur.
//
// Sur Android, un fichier venant de Proton Drive peut être refusé à la
// lecture d'un coup (NotReadableError), alors qu'un lecteur <audio> arrive à
// le lire. On essaie donc, dans l'ordre :
// 1. la lecture d'un coup ;
// 2. la lecture morceau par morceau, en gardant tout ce qui arrive avant
//    une erreur (cas d'une taille annoncée plus grande que le vrai contenu) ;
// 3. la lecture par une adresse blob:, comme le fait un lecteur <audio>.

export async function readFileBytes(file) {
  try {
    return await file.arrayBuffer();
  } catch (error) {
    for (const [method, read] of [['par morceaux', readStream], ['par adresse blob', readBlobUrl]]) {
      const bytes = await read(file);
      if (bytes.byteLength > 0) {
        console.warn(`${file.name} : lu ${method}, ${bytes.byteLength} octets sur ${file.size} annoncés.`);
        return bytes;
      }
    }
    throw error;
  }
}

async function readStream(file) {
  try {
    return await readUntilError(file.stream());
  } catch {
    return new ArrayBuffer(0);
  }
}

async function readBlobUrl(file) {
  let url = null;
  try {
    url = URL.createObjectURL(file);
    const response = await fetch(url);
    return await readUntilError(response.body);
  } catch {
    return new ArrayBuffer(0);
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

async function readUntilError(stream) {
  const chunks = [];
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } catch {
    // fin du contenu lisible
  }
  return joinChunks(chunks);
}

function joinChunks(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}
