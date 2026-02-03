-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function that will be called by the cron job.
-- This function will call a Supabase Edge Function to do the actual work.
CREATE OR REPLACE FUNCTION daily_video_collection() 
RETURNS void AS $$
BEGIN
    -- Perform a non-blocking HTTP request to the Edge Function endpoint
    -- This delegates the heavy lifting to a serverless function, which is best practice.
    PERFORM net.http_post(
        url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/collect-and-analyze-videos',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_SUPABASE_ANON_KEY>"}',
        body := '{}'::jsonb
    );
END;
$$ LANGUAGE plpgsql;

-- Schedule the function to run every day at midnight (00:00 KST is 15:00 UTC the previous day)
-- We will schedule it for 15:00 UTC.
SELECT cron.schedule(
    'daily-video-collection-job',
    '0 15 * * *', -- 0 minutes, 15th hour (UTC) == 00:00 KST
    'SELECT daily_video_collection()'
);

-- To unschedule the job if needed:
-- SELECT cron.unschedule('daily-video-collection-job');

-- To check running jobs:
-- SELECT * FROM cron.job;

-- NOTE: 
-- 1. Replace <YOUR_PROJECT_REF> with your actual Supabase project reference.
-- 2. Replace <YOUR_SUPABASE_ANON_KEY> with your Supabase anonymous key.
-- 3. You need to create a Supabase Edge Function named 'collect-and-analyze-videos'.
