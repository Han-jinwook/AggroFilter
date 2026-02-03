// Standalone Node.js script for daily video collection
// To run: node scripts/collector.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing required environment variables.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const youtube = google.youtube('v3');

// Popular video categories in South Korea
const VIDEO_CATEGORY_IDS = ['1', '10', '17', '20', '22', '24', '25', '28'];

async function fetchPopularVideos() {
    console.log('Fetching popular videos from YouTube...');
    try {
        const response = await youtube.videos.list({
            auth: YOUTUBE_API_KEY,
            part: 'snippet,statistics',
            chart: 'mostPopular',
            regionCode: 'KR',
            maxResults: 50,
            videoCategoryId: VIDEO_CATEGORY_IDS.join(','),
        });
        return response.data.items || [];
    } catch (error) {
        console.error('Error fetching from YouTube API:', error.message);
        if (error.response?.data?.error?.message) {
            console.error('YouTube API Error Details:', error.response.data.error.message);
        }
        // Stop execution if YouTube API fails (e.g., quota exceeded)
        throw new Error('Stopping due to YouTube API failure.');
    }
}

async function saveVideosToDB(videos) {
    if (!videos || videos.length === 0) {
        console.log('No videos to save.');
        return;
    }

    console.log(`Preparing to save ${videos.length} videos to the database...`);

    const videoRecords = videos.map(video => ({
        f_video_id: video.id,
        f_title: video.snippet.title,
        f_description: video.snippet.description,
        f_channel_id: video.snippet.channelId,
        f_channel_title: video.snippet.channelTitle,
        f_published_at: video.snippet.publishedAt,
        f_thumbnail_url: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
        f_view_count: parseInt(video.statistics?.viewCount, 10) || 0,
        f_like_count: parseInt(video.statistics?.likeCount, 10) || 0,
        f_official_category_id: parseInt(video.snippet.categoryId, 10) || null,
    }));

    const { error } = await supabase.from('t_videos').upsert(videoRecords, {
        onConflict: 'f_video_id',
        ignoreDuplicates: false,
    });

    if (error) {
        console.error('Error saving videos to Supabase:', error.message);
        throw new Error('Stopping due to database error.');
    }

    console.log(`Successfully saved ${videoRecords.length} videos.`);
}

async function run() {
    console.log(`Starting daily video collection job at ${new Date().toISOString()}`);
    try {
        const videos = await fetchPopularVideos();
        await saveVideosToDB(videos);
        console.log('Job finished successfully.');
    } catch (error) {
        console.error('Job failed:', error.message);
        process.exit(1);
    } finally {
        console.log(`Job ended at ${new Date().toISOString()}`);
    }
}

run();
