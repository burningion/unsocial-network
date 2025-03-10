-- Create database for our application
CREATE DATABASE IF NOT EXISTS unsocial;

-- Switch to using the database
USE unsocial;

-- Create a table to store data from Kafka
CREATE TABLE IF NOT EXISTS kafka_user_interactions
(
    event_id String,
    user_id String,
    video_id String,
    timestamp Int64,
    event_type Enum('video_watch' = 1, 'video_like' = 2, 'video_comment' = 3, 'video_skip' = 4),
    session_id Nullable(String),
    device_info Nullable(String),
    geo_location Nullable(String),
    
    -- Video Watch specific fields
    watch_duration_ms Nullable(Int32),
    video_duration_ms Nullable(Int32),
    watch_percentage Nullable(Float64),
    playback_quality Nullable(String),
    is_autoplay Nullable(UInt8),
    is_fullscreen Nullable(UInt8),
    
    -- Video Like specific fields
    is_liked Nullable(UInt8),
    
    -- Video Comment specific fields
    comment_id Nullable(String),
    comment_text Nullable(String),
    parent_comment_id Nullable(String),
    
    -- Video Skip specific fields
    skip_time_ms Nullable(Int32),
    skip_type Nullable(String)
) ENGINE = Kafka
SETTINGS kafka_broker_list = 'redpanda:9092',
         kafka_topic_list = 'user-interactions',
         kafka_group_name = 'clickhouse_consumer',
         kafka_format = 'JSONEachRow',
         kafka_max_block_size = 1000;

-- Create MergeTree table for storing video watch events
CREATE TABLE IF NOT EXISTS video_watch_events
(
    event_id String,
    user_id String,
    video_id String,
    event_time DateTime DEFAULT toDateTime(timestamp/1000),
    timestamp Int64,
    session_id Nullable(String),
    watch_duration_ms Int32,
    video_duration_ms Int32,
    watch_percentage Float64,
    playback_quality Nullable(String),
    is_autoplay UInt8,
    is_fullscreen UInt8,
    device_info Nullable(String),
    geo_location Nullable(String)
) ENGINE = MergeTree()
ORDER BY (event_time, user_id, video_id);

-- Create MergeTree table for storing video like events
CREATE TABLE IF NOT EXISTS video_like_events
(
    event_id String,
    user_id String,
    video_id String,
    event_time DateTime DEFAULT toDateTime(timestamp/1000),
    timestamp Int64,
    session_id Nullable(String),
    is_liked UInt8,
    device_info Nullable(String),
    geo_location Nullable(String)
) ENGINE = MergeTree()
ORDER BY (event_time, user_id, video_id);

-- Create MergeTree table for storing video comment events
CREATE TABLE IF NOT EXISTS video_comment_events
(
    event_id String,
    user_id String,
    video_id String,
    event_time DateTime DEFAULT toDateTime(timestamp/1000),
    timestamp Int64,
    session_id Nullable(String),
    comment_id String,
    comment_text Nullable(String),
    parent_comment_id Nullable(String),
    device_info Nullable(String),
    geo_location Nullable(String)
) ENGINE = MergeTree()
ORDER BY (event_time, user_id, video_id);

-- Create MergeTree table for storing video skip events
CREATE TABLE IF NOT EXISTS video_skip_events
(
    event_id String,
    user_id String,
    video_id String,
    event_time DateTime DEFAULT toDateTime(timestamp/1000),
    timestamp Int64,
    session_id Nullable(String),
    skip_time_ms Int32,
    skip_type String,
    device_info Nullable(String),
    geo_location Nullable(String)
) ENGINE = MergeTree()
ORDER BY (event_time, user_id, video_id);

-- Materialized view for video watch events
CREATE MATERIALIZED VIEW IF NOT EXISTS kafka_video_watch_mv TO video_watch_events AS
SELECT
    event_id,
    user_id,
    video_id,
    timestamp,
    session_id,
    watch_duration_ms,
    video_duration_ms,
    watch_percentage,
    playback_quality,
    is_autoplay,
    is_fullscreen,
    device_info,
    geo_location
FROM kafka_user_interactions
WHERE event_type = 'video_watch';

-- Materialized view for video like events
CREATE MATERIALIZED VIEW IF NOT EXISTS kafka_video_like_mv TO video_like_events AS
SELECT
    event_id,
    user_id,
    video_id,
    timestamp,
    session_id,
    is_liked,
    device_info,
    geo_location
FROM kafka_user_interactions
WHERE event_type = 'video_like';

-- Materialized view for video comment events
CREATE MATERIALIZED VIEW IF NOT EXISTS kafka_video_comment_mv TO video_comment_events AS
SELECT
    event_id,
    user_id,
    video_id,
    timestamp,
    session_id,
    comment_id,
    comment_text,
    parent_comment_id,
    device_info,
    geo_location
FROM kafka_user_interactions
WHERE event_type = 'video_comment';

-- Materialized view for video skip events
CREATE MATERIALIZED VIEW IF NOT EXISTS kafka_video_skip_mv TO video_skip_events AS
SELECT
    event_id,
    user_id,
    video_id,
    timestamp,
    session_id,
    skip_time_ms,
    skip_type,
    device_info,
    geo_location
FROM kafka_user_interactions
WHERE event_type = 'video_skip';