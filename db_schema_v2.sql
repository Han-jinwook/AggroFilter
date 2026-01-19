-- Database Schema Design for AggroFilter v2
-- Following Vibe Coding Rules v2.0 (Prefix f_, Prefix T, Prefix a-, c-, p-)

-- Channels Table
CREATE TABLE t_channels (
    f_channel_id VARCHAR(255) PRIMARY KEY,     -- YouTube Channel ID
    f_title VARCHAR(255) NOT NULL,             -- Channel Name
    f_thumbnail_url TEXT,                      -- Profile Image
    f_official_category_id INT,                -- YouTube Native Category ID
    f_custom_category_id INT,                  -- AI Re-classified Category ID (if applicable)
    f_trust_score INT DEFAULT 0,               -- Total Reliability Score (0-100)
    f_trust_grade VARCHAR(10),                 -- Traffic Light (Green, Yellow, Red)
    f_video_count INT DEFAULT 0,               -- Total analyzed videos
    f_subscriber_count BIGINT DEFAULT 0,
    f_last_analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    f_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Videos Table
CREATE TABLE t_videos (
    f_video_id VARCHAR(255) PRIMARY KEY,       -- YouTube Video ID
    f_channel_id VARCHAR(255) REFERENCES t_channels(f_channel_id),
    f_title VARCHAR(255) NOT NULL,
    f_official_category_id INT,                -- YouTube Native Category ID
    f_custom_category_id INT,                  -- AI Re-classified Category ID
    f_accuracy_score INT,                      -- Accuracy (0-100)
    f_clickbait_score INT,                     -- Clickbait (0-100)
    f_trust_score INT,                         -- Final Trust Score (0-100)
    f_ai_recommended_title TEXT,
    f_summary TEXT,
    f_evaluation_reason TEXT,
    f_view_count BIGINT DEFAULT 0,
    f_analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    f_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rankings Snapshot (Optional, for caching complex queries)
CREATE TABLE t_rankings_cache (
    f_id SERIAL PRIMARY KEY,
    f_channel_id VARCHAR(255) REFERENCES t_channels(f_channel_id),
    f_category_id INT,                         -- Target Category
    f_rank INT,                                -- Rank within category
    f_total_count INT,                         -- Total channels in category
    f_top_percentile DECIMAL(5,2),             -- Calculated Top N%
    f_cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
