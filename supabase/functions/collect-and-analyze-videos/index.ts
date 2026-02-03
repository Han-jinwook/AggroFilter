import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Placeholder for actual YouTube API call
async function fetchPopularVideosFromYouTube(apiKey: string) {
  console.log('Edge Function: Fetching popular videos from YouTube.');
  // In a real implementation, you would fetch data from the YouTube Data API.
  // For now, returning mock data.
  const mockVideos = Array.from({ length: 50 }).map((_, i) => ({
    id: `mock_video_edge_${Date.now()}_${i}`,
    snippet: {
        title: `Edge Mock Video Title ${i + 1}`,
        description: `This is a mock description for an edge function video ${i + 1}.`,
        channelId: `mock_channel_edge_${i % 5}`,
        channelTitle: `Mock Channel Edge ${i % 5}`,
        publishedAt: new Date().toISOString(),
        thumbnails: { high: { url: `https://i.ytimg.com/vi/default/hqdefault.jpg` } }
    },
    statistics: {
        viewCount: Math.floor(Math.random() * 1000000).toString(),
        likeCount: Math.floor(Math.random() * 100000).toString(),
    }
  }));
  return mockVideos;
}

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    if (!YOUTUBE_API_KEY) {
      throw new Error('YouTube API key is not configured in environment variables.');
    }

    // 1. Fetch videos from YouTube
    const videos = await fetchPopularVideosFromYouTube(YOUTUBE_API_KEY);

    // 2. Prepare records for Supabase
    const videoRecords = videos.map(video => ({
      f_video_id: video.id,
      f_title: video.snippet.title,
      f_description: video.snippet.description,
      f_channel_id: video.snippet.channelId,
      f_channel_title: video.snippet.channelTitle,
      f_published_at: video.snippet.publishedAt,
      f_thumbnail_url: video.snippet.thumbnails.high.url,
      f_view_count: parseInt(video.statistics.viewCount, 10) || 0,
      f_like_count: parseInt(video.statistics.likeCount, 10) || 0,
    }));

    // 3. Upsert videos into the database
    const { error: upsertError } = await supabaseClient.from('t_videos').upsert(videoRecords, {
      onConflict: 'f_video_id',
      ignoreDuplicates: false,
    });

    if (upsertError) {
      throw new Error(`Failed to save videos to database: ${upsertError.message}`);
    }

    // 4. TODO: Trigger analysis for the collected videos.
    console.log(`${videoRecords.length} videos collected and saved. Ready for analysis.`);

    return new Response(
      JSON.stringify({ message: `${videos.length} videos collected successfully.` }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
