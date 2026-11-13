import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileBytes } from '../readfile.js';

function notReadable() {
  return new DOMException('could not be read', 'NotReadableError');
}

// Un faux fichier : la lecture d'un coup échoue, le flux donne des morceaux
// puis échoue (ou échoue tout de suite si `chunks` est vide).
function brokenFile(chunks) {
  return {
    name: 'Polka.mp3',
    size: 999,
    arrayBuffer: () => Promise.reject(notReadable()),
    stream: () => {
      const remaining = [...chunks];
      return new ReadableStream({
        pull(controller) {
          if (remaining.length) controller.enqueue(new Uint8Array(remaining.shift()));
          else controller.error(notReadable());
        },
      });
    },
  };
}

test('readFileBytes returns the whole file when it reads normally', async () => {
  const file = new Blob([new Uint8Array([1, 2, 3])]);
  assert.deepEqual([...new Uint8Array(await readFileBytes(file))], [1, 2, 3]);
});

test('readFileBytes keeps the bytes read before the error', async () => {
  const bytes = await readFileBytes(brokenFile([[1, 2], [3]]));
  assert.deepEqual([...new Uint8Array(bytes)], [1, 2, 3]);
});

test('readFileBytes throws the original error when nothing can be read', async () => {
  await assert.rejects(readFileBytes(brokenFile([])), { name: 'NotReadableError' });
});
