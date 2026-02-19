/**
 * Helper functions for Ranking v3.1
 */
import { pool } from "@/lib/db";
import { getLanguageDisplayName, getLanguageIcon } from "@/lib/language-detection";

export interface ActiveLanguage {
  language: string;
  channelCount: number;
  displayName: string;
  icon: string;
}

/**
 * Get list of active languages with channel counts
 * Used for language dropdown in ranking page
 */
export async function getActiveLanguages(): Promise<ActiveLanguage[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        f_language,
        COUNT(DISTINCT f_channel_id) as channel_count
      FROM t_rankings_cache
      GROUP BY f_language
      HAVING COUNT(DISTINCT f_channel_id) > 0
      ORDER BY channel_count DESC
    `);
    
    return res.rows.map(row => ({
      language: row.f_language,
      channelCount: parseInt(row.channel_count, 10),
      displayName: getLanguageDisplayName(row.f_language),
      icon: getLanguageIcon(row.f_language),
    }));
  } finally {
    client.release();
  }
}
