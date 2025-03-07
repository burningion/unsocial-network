import time
import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Union
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Redpanda client (using aiokafka as the client)
from aiokafka import AIOKafkaProducer
import os
import asyncio
import json

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Redpanda producer
    global producer
    producer = AIOKafkaProducer(
        bootstrap_servers=os.environ.get('REDPANDA_BROKERS', 'redpanda:9092'),
        value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        # Configure for optimal throughput and latency
        acks='all',  # Ensure data is properly replicated
        compression_type='gzip',  # Compress messages
        linger_ms=5,  # Small delay to batch messages
    )
    await producer.start()
    
    yield  # This separates startup from shutdown logic
    
    # Shutdown logic - stop the producer
    if producer:
        await producer.stop()

# Create FastAPI app
app = FastAPI(
    title="Video Recommendation Event Capture API",
    description="API for capturing user interaction events for video recommendation system",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Redpanda producer
producer = None

# Topic names
USER_INTERACTIONS_TOPIC = "user-interactions"


class EventType(str, Enum):
    VIDEO_WATCH = "video_watch"
    VIDEO_LIKE = "video_like"
    VIDEO_COMMENT = "video_comment"
    VIDEO_SKIP = "video_skip"


class BaseEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    video_id: str
    timestamp: int = Field(default_factory=lambda: int(time.time() * 1000))  # Milliseconds since epoch
    event_type: EventType
    session_id: Optional[str] = None
    device_info: Optional[Dict] = None
    geo_location: Optional[Dict] = None


class VideoWatchEvent(BaseEvent):
    event_type: EventType = EventType.VIDEO_WATCH
    watch_duration_ms: int
    video_duration_ms: int
    watch_percentage: float = None
    playback_quality: Optional[str] = None
    is_autoplay: bool = False
    is_fullscreen: bool = False
    
    def __init__(self, **data):
        super().__init__(**data)
        # Calculate watch percentage if not provided
        if self.watch_percentage is None and self.video_duration_ms > 0:
            self.watch_percentage = round((self.watch_duration_ms / self.video_duration_ms) * 100, 2)


class VideoLikeEvent(BaseEvent):
    event_type: EventType = EventType.VIDEO_LIKE
    is_liked: bool  # True for like, False for unlike


class VideoCommentEvent(BaseEvent):
    event_type: EventType = EventType.VIDEO_COMMENT
    comment_id: str
    comment_text: Optional[str] = None
    parent_comment_id: Optional[str] = None  # For reply comments


class VideoSkipEvent(BaseEvent):
    event_type: EventType = EventType.VIDEO_SKIP
    skip_time_ms: int  # Time at which the video was skipped
    skip_type: str = "manual"  # manual, auto, recommendation


# Union type for all event types
EventUnion = Union[VideoWatchEvent, VideoLikeEvent, VideoCommentEvent, VideoSkipEvent]


# Batch event submission model
class EventBatch(BaseModel):
    events: List[Dict]  # List of serialized events



# Helper function to determine event class from dict
def get_event_model(event_data: Dict):
    event_type = event_data.get('event_type')
    if event_type == EventType.VIDEO_WATCH:
        return VideoWatchEvent
    elif event_type == EventType.VIDEO_LIKE:
        return VideoLikeEvent
    elif event_type == EventType.VIDEO_COMMENT:
        return VideoCommentEvent
    elif event_type == EventType.VIDEO_SKIP:
        return VideoSkipEvent
    else:
        raise ValueError(f"Unknown event type: {event_type}")


# Background task to send event to Redpanda
async def send_event_to_redpanda(event: Dict):
    try:
        # Add metadata for partitioning and processing
        # Use user_id as the key to ensure user events go to the same partition
        key = event.get('user_id', '').encode('utf-8')
        await producer.send_and_wait(USER_INTERACTIONS_TOPIC, event, key=key)
    except Exception as e:
        # In production, you'd want to log this and possibly retry
        print(f"Error sending event to Redpanda: {e}")
        # Consider adding to a dead-letter queue


@app.post("/events/{event_type}", status_code=202)
async def capture_event(
    event_type: EventType,
    event_data: Dict,
    background_tasks: BackgroundTasks
):
    try:
        # Create the correct event model based on type
        if event_type == EventType.VIDEO_WATCH:
            event = VideoWatchEvent(**event_data)
        elif event_type == EventType.VIDEO_LIKE:
            event = VideoLikeEvent(**event_data)
        elif event_type == EventType.VIDEO_COMMENT:
            event = VideoCommentEvent(**event_data)
        elif event_type == EventType.VIDEO_SKIP:
            event = VideoSkipEvent(**event_data)
        
        # Validate event data through Pydantic
        event_dict = event.dict()
        
        # Send to Redpanda asynchronously
        background_tasks.add_task(send_event_to_redpanda, event_dict)
        
        return {"status": "accepted", "event_id": event.event_id}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid event data: {str(e)}")


@app.post("/events/batch", status_code=202)
async def capture_event_batch(
    batch: EventBatch,
    background_tasks: BackgroundTasks
):
    valid_events = []
    invalid_events = []
    
    for event_data in batch.events:
        try:
            # Get correct event model
            event_model = get_event_model(event_data)
            # Validate through Pydantic
            event = event_model(**event_data)
            valid_events.append(event.dict())
        except Exception as e:
            invalid_events.append({
                "event": event_data,
                "error": str(e)
            })
    
    # Process valid events
    for event in valid_events:
        background_tasks.add_task(send_event_to_redpanda, event)
    
    return {
        "status": "accepted",
        "processed_count": len(valid_events),
        "invalid_count": len(invalid_events),
        "invalid_events": invalid_events if invalid_events else None
    }


@app.get("/health")
async def health_check():
    # Basic health check endpoint
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": app.version
    }


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)