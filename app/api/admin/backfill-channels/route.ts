import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const configured = (process.env.ADMIN_SCHEMA_TOKEN || '').trim();
  if (!configured) return false;
  const provided = (request.headers.get('x-admin-token') || '').trim();
  return provided && provided === configured;
}

type BackfillRequest = {
  limit?: number;
  onlyMissing?: boolean;
  channelIds?: string[];
};

type ColumnInfo = {
  keyCol: 'f_channel_id' | 'f_id';
  titleCol: 'f_title' | 'f_name';
  thumbCol: 'f_thumbnail_url' | 'f_profile_image_url';
};

async function getColumnInfo(client: any): Promise<ColumnInfo> {
  const res = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 't_channels'
        AND column_name IN (
          'f_channel_id',
          'f_id',
          'f_title',
          'f_name',
          'f_thumbnail_url',
          'f_profile_image_url'
        )
    `,
  );

  const set = new Set<string>(res.rows.map((r: any) => r.column_name));

  const keyCol = (set.has('f_channel_id') ? 'f_channel_id' : set.has('f_id') ? 'f_id' : null) as ColumnInfo['keyCol'] | null;
  const titleCol = (set.has('f_title') ? 'f_title' : set.has('f_name') ? 'f_name' : null) as ColumnInfo['titleCol'] | null;
  const thumbCol = (set.has('f_thumbnail_url')
    ? 'f_thumbnail_url'
    : set.has('f_profile_image_url')
      ? 'f_profile_image_url'
      : null) as ColumnInfo['thumbCol'] | null;

  if (!keyCol || !titleCol || !thumbCol) {
    throw new Error('t_channels 테이블 컬럼 구성이 예상과 다릅니다.');
  }

  return { keyCol, titleCol, thumbCol };
}

async function fetchYouTubeChannels(ids: string[], apiKey: string) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('key', apiKey);

  const resp = await fetch(url.toString());
  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(`YouTube API 오류: ${data?.error?.message || resp.statusText}`);
  }

  const items = Array.isArray(data?.items) ? data.items : [];

  return items.map((item: any) => {
    const snippet = item?.snippet || {};
    const thumbs = snippet?.thumbnails || {};
    const thumbnailUrl =
      thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || '';

    return {
      channelId: String(item?.id || '').trim(),
      title: String(snippet?.title || '').trim(),
      thumbnailUrl: String(thumbnailUrl || '').trim(),
    };
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YOUTUBE_API_KEY is not configured.' },
      { status: 500 },
    );
  }

  let body: BackfillRequest = {};
  try {
    body = (await request.json()) as BackfillRequest;
  } catch {
    body = {};
  }

  const limit = Math.min(Math.max(Number(body.limit || 200), 1), 2000);
  const onlyMissing = body.onlyMissing !== false;
  const explicitIds = Array.isArray(body.channelIds)
    ? body.channelIds.map((v) => String(v).trim()).filter(Boolean)
    : null;

  const client = await pool.connect();
  try {
    const { keyCol, titleCol, thumbCol } = await getColumnInfo(client);

    let channelIds: string[] = [];

    if (explicitIds && explicitIds.length > 0) {
      channelIds = explicitIds.slice(0, limit);
    } else {
      const whereMissing = onlyMissing
        ? `AND (
            c IS NULL
            OR NULLIF(c.${titleCol}, '') IS NULL
            OR NULLIF(c.${thumbCol}, '') IS NULL
          )`
        : '';

      const res = await client.query(
        `
          SELECT DISTINCT a.f_channel_id
          FROM t_analyses a
          LEFT JOIN t_channels c
            ON a.f_channel_id = COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id')
          WHERE a.f_channel_id IS NOT NULL
            AND a.f_channel_id <> ''
            ${whereMissing}
          ORDER BY a.f_channel_id
          LIMIT $1
        `,
        [limit],
      );

      channelIds = res.rows.map((r: any) => String(r.f_channel_id).trim()).filter(Boolean);
    }

    if (channelIds.length === 0) {
      return NextResponse.json({
        requested: 0,
        fetched: 0,
        updated: 0,
        inserted: 0,
        notFoundOnYouTube: 0,
        message: '대상 채널이 없습니다.',
      });
    }

    let updated = 0;
    let inserted = 0;
    const notFoundOnYouTube: string[] = [];

    for (let i = 0; i < channelIds.length; i += 50) {
      const batch = channelIds.slice(i, i + 50);
      const ytChannels = await fetchYouTubeChannels(batch, apiKey);
      const foundSet = new Set(ytChannels.map((c) => c.channelId));

      for (const id of batch) {
        if (!foundSet.has(id)) notFoundOnYouTube.push(id);
      }

      await client.query('BEGIN');
      try {
        for (const ch of ytChannels) {
          if (!ch.channelId) continue;

          const titleValue = ch.title || null;
          const thumbValue = ch.thumbnailUrl || null;

          const updateRes = await client.query(
            `
              UPDATE t_channels
              SET
                ${titleCol} = COALESCE(NULLIF($2, ''), ${titleCol}),
                ${thumbCol} = COALESCE(NULLIF($3, ''), ${thumbCol})
              WHERE ${keyCol} = $1
            `,
            [ch.channelId, titleValue, thumbValue],
          );

          if (updateRes.rowCount && updateRes.rowCount > 0) {
            updated += updateRes.rowCount;
            continue;
          }

          const insertRes = await client.query(
            `
              INSERT INTO t_channels (${keyCol}, ${titleCol}, ${thumbCol})
              VALUES ($1, $2, $3)
            `,
            [ch.channelId, titleValue, thumbValue],
          );

          if (insertRes.rowCount && insertRes.rowCount > 0) {
            inserted += insertRes.rowCount;
          }
        }

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    return NextResponse.json({
      requested: channelIds.length,
      fetched: channelIds.length - notFoundOnYouTube.length,
      updated,
      inserted,
      notFoundOnYouTube: notFoundOnYouTube.length,
      sampleNotFoundOnYouTube: notFoundOnYouTube.slice(0, 20),
      columnMapping: { keyCol, titleCol, thumbCol },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
