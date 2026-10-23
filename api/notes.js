import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.',
    });
  }

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    return res.status(503).json({
      error: '서버의 DB 연결 설정이 필요합니다.',
    });
  }

  try {
    const supabase = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await supabase
      .from('notes')
      .select('title, content')
      .order('id', { ascending: true });

    if (error) {
      return res.status(502).json({
        error: '메모를 불러오지 못했습니다.',
      });
    }

    return res.status(200).json({
      sampleMarker: 'SAMPLE_NOTE_1',
      notes: data,
    });
  } catch {
    return res.status(502).json({
      error: 'DB 연결에 실패했습니다.',
    });
  }
}