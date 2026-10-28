import { stampResponse } from '../src/request-stamp.mjs';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import { verifyDevice } from '../src/verify-device.mjs';
import {
  readNoteBackup,
  noteHash,
  BACKUP_SHA256,
} from '../src/note-recovery.mjs';

const config = JSON.parse(
  readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8')
);

function audit(action, result) {
  console.info(JSON.stringify({
    at: new Date().toISOString(),
    action,
    result,
    targetId: '6',
    service: 'notes',
  }));
}

export default async function handler(req, res) {
  stampResponse(res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'method_not_allowed',
    });
  }

  if (!req.headers.authorization) {
    return res.status(401).json({
      error: 'login_required',
    });
  }

  if (
    req.headers.origin &&
    req.headers.origin !== new URL(config.publicAppUrl).origin
  ) {
    return res.status(403).json({
      error: 'origin_not_allowed',
    });
  }

  if (
    !/^application\/json(?:;|$)/i.test(
      req.headers['content-type'] || ''
    )
  ) {
    return res.status(415).json({
      error: 'json_required',
    });
  }

  let database;
  let identity;
  let backup;

  try {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (
      !url ||
      !secretKey ||
      new URL(url).origin + '/auth/v1' !==
        config.identityProvider?.issuer
    ) {
      throw new Error('invalid_server_configuration');
    }

    const verifyLogin = createLoginVerifier({
      config,
      supabaseSecretKey: secretKey,
    });

    identity = await verifyLogin(req.headers.authorization);

    if (!identity) {
      return res.status(401).json({
        error: 'invalid_login',
      });
    }

    backup = readNoteBackup(process.env.STAGE10_NOTE_BACKUP_JSON);

    database = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    audit('restore_configuration', 'unavailable');
    return res.status(503).json({
      error: 'restore_unavailable',
    });
  }

  if (identity.userId !== backup.owner_id) {
    audit('restore_access', 'denied');
    return res.status(403).json({
      error: 'restore_not_allowed',
    });
  }

  try {
    const device = await verifyDevice({
      database,
      userId: identity.userId,
      token: req.headers['x-vault-device'],
    });

    if (!device) {
      audit('restore_device', 'denied');
      return res.status(403).json({
        error: 'approved_device_required',
      });
    }
  } catch {
    audit('restore_device', 'unavailable');
    return res.status(503).json({
      error: 'device_verification_unavailable',
    });
  }

  let body;

  try {
    body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    const allowedKeys = new Set([
      'action',
      'confirm',
      'expectedCurrentHash',
    ]);

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !allowedKeys.has(key)) ||
      !['plan', 'restore'].includes(body.action)
    ) {
      throw new Error('invalid_request');
    }
  } catch {
    return res.status(400).json({
      error: 'invalid_restore_request',
    });
  }

  try {
    const { data: current, error } = await database
      .from('notes')
      .select('id,owner_id,title,content')
      .eq('id', backup.id)
      .maybeSingle();

    if (error) throw error;

    if (current && current.owner_id !== backup.owner_id) {
      return res.status(409).json({
        error: 'target_owner_mismatch',
      });
    }

    const currentHash = current
      ? noteHash({
          id: current.id,
          owner_id: current.owner_id,
          title: current.title,
          body: current.content,
        })
      : null;

    if (body.action === 'plan') {
      audit('restore_plan', 'ready');

      return res.status(200).json({
        targetId: backup.id,
        ownerMatches: true,
        currentHash,
        backupHash: BACKUP_SHA256,
        changed: currentHash !== BACKUP_SHA256,
        scope: 'single_note',
      });
    }

    if (
      body.confirm !== true ||
      !Object.hasOwn(body, 'expectedCurrentHash')
    ) {
      return res.status(400).json({
        error: 'confirmation_required',
      });
    }

    if (body.expectedCurrentHash !== currentHash) {
      return res.status(409).json({
        error: 'target_changed_review_again',
      });
    }

    if (currentHash !== BACKUP_SHA256) {
      if (current) {
        const { data: updated, error: updateError } = await database
          .from('notes')
          .update({
            title: backup.title,
            content: backup.body,
          })
          .eq('id', backup.id)
          .eq('owner_id', backup.owner_id)
          .eq('title', current.title)
          .eq('content', current.content)
          .select('id')
          .maybeSingle();

        if (updateError) throw updateError;

        if (!updated) {
          return res.status(409).json({
            error: 'target_changed_review_again',
          });
        }
      } else {
        const { error: insertError } = await database
          .from('notes')
          .insert({
            id: backup.id,
            owner_id: backup.owner_id,
            title: backup.title,
            content: backup.body,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            return res.status(409).json({
              error: 'target_changed_review_again',
            });
          }

          throw insertError;
        }
      }
    }

    const { data: restored, error: readError } = await database
      .from('notes')
      .select('id,owner_id,title,content')
      .eq('id', backup.id)
      .eq('owner_id', backup.owner_id)
      .single();

    if (readError) throw readError;

    const restoredHash = noteHash({
      id: restored.id,
      owner_id: restored.owner_id,
      title: restored.title,
      body: restored.content,
    });

    if (restoredHash !== BACKUP_SHA256) {
      throw new Error('restore_verification_failed');
    }

    audit('restore_note', 'verified');

    return res.status(200).json({
      targetId: backup.id,
      restored: true,
      ownerMatches: true,
      sha256: restoredHash,
    });
  } catch {
    audit('restore_note', 'failed');

    return res.status(502).json({
      error: 'restore_failed',
    });
  }
}