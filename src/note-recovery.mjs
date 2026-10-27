import { createHash } from 'node:crypto';

export const BACKUP_SHA256 =
  'b0d9c0a5db643c52755793980fbf931bbef8c83042c000aa1636883185e46011';

export function noteHash(note) {
  return createHash('sha256')
    .update(JSON.stringify([
      String(note.id),
      note.owner_id,
      note.title,
      note.body,
    ]), 'utf8')
    .digest('hex');
}

export function readNoteBackup(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('backup_unavailable');
  }

  let backup;
  try {
    backup = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('invalid_backup');
  }

  const note = backup?.note;

  if (
    backup?.schema !== 'vault.note-backup.v1' ||
    note?.id !== '6' ||
    typeof note.owner_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(note.owner_id) ||
    typeof note.title !== 'string' ||
    !note.title.trim() ||
    note.title.length > 200 ||
    typeof note.body !== 'string' ||
    !note.body.trim() ||
    note.body.length > 20000
  ) {
    throw new Error('invalid_backup');
  }

  if (
    backup.sha256 !== BACKUP_SHA256 ||
    noteHash(note) !== BACKUP_SHA256
  ) {
    throw new Error('backup_hash_mismatch');
  }

  return Object.freeze({
    id: note.id,
    owner_id: note.owner_id,
    title: note.title,
    body: note.body,
  });
}