#!/usr/bin/env python3
"""
ClickHouse Video Analytics Script

This script connects to a ClickHouse database and runs several analytics queries
on video interaction data, saving results to CSV files.
"""

import os
import csv
import pandas as pd
from clickhouse_driver import Client
from datetime import datetime

# Configuration
CLICKHOUSE_HOST = 'clickhouse'
CLICKHOUSE_PORT = 9000  # Native protocol port
# CLICKHOUSE_PORT = 8123  # HTTP protocol port
CLICKHOUSE_USER = 'default'
CLICKHOUSE_PASSWORD = ''  # Update if you have a password
CLICKHOUSE_DATABASE = 'unsocial'  # Update with your database name

# Output directory for CSV files
OUTPUT_DIR = 'video_analytics_results'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Initialize ClickHouse client
def get_clickhouse_client():
    return Client(
        host=CLICKHOUSE_HOST,
        port=CLICKHOUSE_PORT,
        user=CLICKHOUSE_USER,
        password=CLICKHOUSE_PASSWORD,
        database=CLICKHOUSE_DATABASE,
        settings={
            "stream_like_engine_allow_direct_select": 1
            # 'use_numpy': True  # Uncomment for better performance with pandas
        }
    )

# Function to run a query and save results to CSV
def run_query_and_save(client, query, filename, description):
    print(f"\nRunning query: {description}")
    try:
        # Execute query
        result = client.execute(query, with_column_types=True)
        
        # Extract data and column names
        data, column_types = result
        column_names = [col_name for col_name, _ in column_types]
        
        # Convert to pandas DataFrame for easier handling
        df = pd.DataFrame(data, columns=column_names)
        
        # Save to CSV
        csv_path = os.path.join(OUTPUT_DIR, f"{filename}.csv")
        df.to_csv(csv_path, index=False, quoting=csv.QUOTE_NONNUMERIC)
        
        # Print preview
        print(f"Results saved to {csv_path}")
        print(f"Preview of results:")
        print(df.head(5))
        print(f"Total rows: {len(df)}")
        
        return df
    except Exception as e:
        print(f"Error executing query: {e}")
        return None

def main():
    # Connect to ClickHouse
    client = get_clickhouse_client()
    print(f"Connected to ClickHouse at {CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}")
    
    # Dictionary of queries to run
    queries = {
        "event_counts": {
            "query": """
                WITH all_events AS (
                    SELECT 'video_watch' as event_type, count() AS count FROM unsocial.video_watch_events
                    UNION ALL
                    SELECT 'video_like' as event_type, count() AS count FROM unsocial.video_like_events
                    UNION ALL
                    SELECT 'video_comment' as event_type, count() AS count FROM unsocial.video_comment_events
                    UNION ALL
                    SELECT 'video_skip' as event_type, count() AS count FROM unsocial.video_skip_events
                )
                SELECT event_type, count FROM all_events
                ORDER BY count DESC
            """,
            "description": "Count of events by type"
        },
        "top_videos_by_viewers": {
            "query": """
                SELECT 
                    video_id,
                    COUNT(DISTINCT user_id) AS unique_viewers
                FROM unsocial.video_watch_events
                GROUP BY video_id
                ORDER BY unique_viewers DESC
                LIMIT 10
            """,
            "description": "Top 10 most watched videos (by unique users)"
        },
        "top_videos_by_watch_time": {
            "query": """
                SELECT 
                    video_id,
                    SUM(watch_duration_ms) / 1000 / 60 AS total_watch_minutes,
                    COUNT(DISTINCT user_id) AS unique_viewers,
                    SUM(watch_duration_ms) / COUNT(DISTINCT user_id) / 1000 AS avg_seconds_per_user
                FROM unsocial.video_watch_events
                GROUP BY video_id
                ORDER BY total_watch_minutes DESC
                LIMIT 10
            """,
            "description": "Top 10 most engaged videos (by watch time)"
        },
        "video_completion_rates": {
            "query": """
                SELECT 
                    video_id,
                    COUNT() AS total_views,
                    SUM(if(watch_percentage >= 90, 1, 0)) AS completed_views,
                    SUM(if(watch_percentage >= 90, 1, 0)) / COUNT() AS completion_rate
                FROM unsocial.video_watch_events
                GROUP BY video_id
                HAVING total_views > 10
                ORDER BY completion_rate DESC
                LIMIT 20
            """,
            "description": "Completion rate by video"
        },
        "daily_active_users": {
            "query": """
                SELECT 
                    toDate(event_time) AS date,
                    COUNT(DISTINCT user_id) AS daily_active_users
                FROM unsocial.video_watch_events
                GROUP BY date
                ORDER BY date
            """,
            "description": "User engagement over time (daily active users)"
        },
        "most_engaging_videos": {
            "query": """
                SELECT 
                    video_id,
                    AVG(watch_percentage) AS avg_completion,
                    COUNT() AS total_views
                FROM unsocial.video_watch_events
                GROUP BY video_id
                HAVING total_views >= 10
                ORDER BY avg_completion DESC
                LIMIT 20
            """,
            "description": "Most engaging video dimensions (based on completion rate)"
        },
        "video_skip_rates": {
            "query": """
                SELECT 
                    video_id,
                    COUNT() AS total_skips,
                    AVG(skip_time_ms) / 1000 AS avg_skip_time_seconds
                FROM unsocial.video_skip_events
                GROUP BY video_id
                ORDER BY total_skips DESC
                LIMIT 20
            """,
            "description": "Skip rate by video"
        },
        "comment_engagement": {
            "query": """
                SELECT 
                    video_id,
                    COUNT() AS comment_count,
                    COUNT(DISTINCT user_id) AS unique_commenters
                FROM unsocial.video_comment_events
                GROUP BY video_id
                ORDER BY comment_count DESC
                LIMIT 20
            """,
            "description": "Comment engagement by video"
        },
        "hourly_activity": {
            "query": """
                SELECT 
                    toHour(event_time) AS hour_of_day,
                    count() AS event_count
                FROM unsocial.video_watch_events
                GROUP BY hour_of_day
                ORDER BY hour_of_day
            """,
            "description": "User activity heatmap (hour of day)"
        },
        "device_performance": {
            "query": """
                SELECT 
                    JSONExtractString(device_info, 'deviceType') AS device_type,
                    COUNT() AS view_count,
                    AVG(watch_percentage) AS avg_completion
                FROM unsocial.video_watch_events
                WHERE device_info IS NOT NULL
                GROUP BY device_type
                ORDER BY avg_completion DESC
            """,
            "description": "Content performance by device type"
        },
        "like_to_view_ratio": {
            "query": """
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
                LIMIT 20
            """,
            "description": "Like to view ratio by video"
        }
    }
    
    # Run all queries
    results = {}
    for filename, query_info in queries.items():
        results[filename] = run_query_and_save(
            client, 
            query_info["query"], 
            filename, 
            query_info["description"]
        )
    
    print(f"\nAnalysis complete. All results saved to {OUTPUT_DIR}/ directory.")
    
    # Additional summary information
    if results["event_counts"] is not None:
        total_events = results["event_counts"]["count"].sum()
        print(f"\nTotal events analyzed: {total_events:,}")
    
    if results["daily_active_users"] is not None:
        avg_dau = results["daily_active_users"]["daily_active_users"].mean()
        print(f"Average daily active users: {avg_dau:.2f}")

if __name__ == "__main__":
    start_time = datetime.now()
    print(f"Starting ClickHouse video analytics at {start_time}")
    
    main()
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    print(f"Analysis completed in {duration:.2f} seconds")