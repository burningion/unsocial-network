-- Sample ClickHouse Queries for Analyzing Video Interaction Data

-- 1. Count events by type
SELECT event_type, count() AS count
FROM unsocial.kafka_user_interactions
GROUP BY event_type
ORDER BY count DESC;

-- 2. Top 10 most watched videos (by unique users)
SELECT 
    video_id,
    COUNT(DISTINCT user_id) AS unique_viewers
FROM unsocial.video_watch_events
GROUP BY video_id
ORDER BY unique_viewers DESC
LIMIT 10;

-- 3. Top 10 most engaged videos (by watch time)
SELECT 
    video_id,
    SUM(watch_duration_ms) / 1000 / 60 AS total_watch_minutes,
    COUNT(DISTINCT user_id) AS unique_viewers,
    SUM(watch_duration_ms) / COUNT(DISTINCT user_id) / 1000 AS avg_seconds_per_user
FROM unsocial.video_watch_events
GROUP BY video_id
ORDER BY total_watch_minutes DESC
LIMIT 10;

-- 4. Completion rate by video
SELECT 
    video_id,
    COUNT() AS total_views,
    SUM(if(watch_percentage >= 90, 1, 0)) AS completed_views,
    SUM(if(watch_percentage >= 90, 1, 0)) / COUNT() AS completion_rate
FROM unsocial.video_watch_events
GROUP BY video_id
HAVING total_views > 10
ORDER BY completion_rate DESC
LIMIT 20;

-- 5. User engagement over time (daily active users)
SELECT 
    toDate(event_time) AS date,
    COUNT(DISTINCT user_id) AS daily_active_users
FROM unsocial.video_watch_events
GROUP BY date
ORDER BY date;

-- 6. Most engaging video dimensions (based on completion rate)
SELECT 
    video_id,
    AVG(watch_percentage) AS avg_completion,
    COUNT() AS total_views
FROM unsocial.video_watch_events
GROUP BY video_id
HAVING total_views >= 10
ORDER BY avg_completion DESC
LIMIT 20;

-- 7. Skip rate by video
SELECT 
    video_id,
    COUNT() AS total_skips,
    AVG(skip_time_ms) / 1000 AS avg_skip_time_seconds
FROM unsocial.video_skip_events
GROUP BY video_id
ORDER BY total_skips DESC
LIMIT 20;

-- 8. Comment engagement by video
SELECT 
    video_id,
    COUNT() AS comment_count,
    COUNT(DISTINCT user_id) AS unique_commenters
FROM unsocial.video_comment_events
GROUP BY video_id
ORDER BY comment_count DESC
LIMIT 20;

-- 9. User activity heatmap (hour of day)
SELECT 
    toHour(event_time) AS hour_of_day,
    count() AS event_count
FROM unsocial.video_watch_events
GROUP BY hour_of_day
ORDER BY hour_of_day;

-- 10. Content performance by device type
SELECT 
    JSONExtractString(device_info, 'deviceType') AS device_type,
    COUNT() AS view_count,
    AVG(watch_percentage) AS avg_completion
FROM unsocial.video_watch_events
WHERE device_info IS NOT NULL
GROUP BY device_type
ORDER BY avg_completion DESC;

-- 11. Like to view ratio by video
SELECT 
    v.video_id,
    COUNT(DISTINCT v.user_id) AS viewers,
    COUNT(DISTINCT l.user_id) AS likers,
    COUNT(DISTINCT l.user_id) / COUNT(DISTINCT v.user_id) AS like_rate
FROM unsocial.video_watch_events v
LEFT JOIN unsocial.video_like_events l ON v.video_id = l.video_id AND l.is_liked = 1
GROUP BY v.video_id
HAVING viewers >= 10
ORDER BY like_rate DESC
LIMIT 20;