import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// This is a placeholder for the actual YouTube API call logic
async function fetchPopularVideosFromYouTube(categoryIds: number[], apiKey: string) {
    // In a real implementation, you would use googleapis to fetch data.
    // For now, we'll return mock data.
    console.log(`Fetching popular videos for categories: ${categoryIds.join(', ')}`);
    
    // Simulate fetching 50 videos
    const mockVideos = Array.from({ length: 50 }).map((_, i) => ({
        id: `mock_video_${Date.now()}_${i}`,
        snippet: {
            title: `Mock Video Title ${i + 1}`,
            description: `This is a mock description for video ${i + 1}.`,
            channelId: `mock_channel_${i % 5}`,
            channelTitle: `Mock Channel ${i % 5}`,
            publishedAt: new Date().toISOString(),
            thumbnails: {
                high: {
                    url: `https://i.ytimg.com/vi/default/hqdefault.jpg`
                }
            }
        },
        statistics: {
            viewCount: Math.floor(Math.random() * 1000000).toString(),
            likeCount: Math.floor(Math.random() * 100000).toString(),
        }
    }));

    return mockVideos;
}

export async function POST(req: NextRequest) {
    const supabase = createClient();

    // 1. Check if user is an admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: userProfile, error: profileError } = await supabase
        .from('t_user_profiles')
        .select('f_role')
        .eq('f_user_id', user.id)
        .single();

    if (profileError || userProfile?.f_role !== 'ADMIN') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 2. Parse request body
    const { budget, categoryIds } = await req.json();

    if (!budget || !Array.isArray(categoryIds)) {
        return NextResponse.json({ error: 'Budget and categoryIds are required.' }, { status: 400 });
    }

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YouTube API key is not configured.' }, { status: 500 });
    }

    try {
        // 3. Fetch popular videos from YouTube (using mock for now)
        const videos = await fetchPopularVideosFromYouTube(categoryIds, YOUTUBE_API_KEY);

        // 4. Prepare data for Supabase insertion
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

        // 5. Upsert videos into t_videos table
        const { error: upsertError } = await supabase.from('t_videos').upsert(videoRecords, {
            onConflict: 'f_video_id',
            ignoreDuplicates: false,
        });

        if (upsertError) {
            console.error('Error upserting videos:', upsertError);
            throw new Error(`Failed to save videos to database: ${upsertError.message}`);
        }

        // 6. TODO: Add logic to trigger Gemini analysis for the new videos
        // For now, we just log the action.
        console.log(`${videoRecords.length} videos have been saved and are ready for analysis.`);

        return NextResponse.json({ message: `${videos.length} videos collected successfully and queued for analysis.` });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred during video collection.';
        console.error('Video collection error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
