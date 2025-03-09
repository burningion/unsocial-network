import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, Heart, MessageCircle, Share2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Sample video data - replace with your actual video sources
const SAMPLE_VIDEOS = [
  {
    id: 'video1',
    src: 'https://assets.mixkit.co/videos/preview/mixkit-woman-dancing-in-the-sunlight-34884-large.mp4',
    title: 'Dancing in Sunlight',
    author: '@sunlight_dancer',
  },
  {
    id: 'video2',
    src: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4',
    title: 'Ocean Waves',
    author: '@ocean_lover',
  },
  {
    id: 'video3',
    src: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4',
    title: 'Spring Blossoms',
    author: '@nature_watcher',
  }
];

function App() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState({});
  const [sessionId] = useState(uuidv4());
  const [userId] = useState(`user_${uuidv4().slice(0, 8)}`);
  const videoRefs = useRef([]);
  const containerRef = useRef(null);
  const touchStartY = useRef(null);
  const startTime = useRef(null);
  const playedDuration = useRef({});
  const watchIntervalRef = useRef(null);
  
  // API endpoint for events
  const API_URL = 'http://localhost:8000';

  // Track video play duration
  useEffect(() => {
    if (isPlaying) {
      const currentVideo = videoRefs.current[currentVideoIndex];
      const videoId = SAMPLE_VIDEOS[currentVideoIndex].id;
      
      if (!playedDuration.current[videoId]) {
        playedDuration.current[videoId] = 0;
      }
      
      startTime.current = Date.now();
      
      watchIntervalRef.current = setInterval(() => {
        if (startTime.current) {
          const currentTime = Date.now();
          const elapsedMs = currentTime - startTime.current;
          playedDuration.current[videoId] += elapsedMs;
          startTime.current = currentTime;
        }
      }, 1000);
    } else {
      clearInterval(watchIntervalRef.current);
      startTime.current = null;
    }

    return () => {
      clearInterval(watchIntervalRef.current);
    };
  }, [currentVideoIndex, isPlaying]);

  // Send watch event when changing videos
  useEffect(() => {
    return () => {
      // This cleanup function will run when component unmounts or when dependency changes
      const previousVideoIndex = currentVideoIndex > 0 ? currentVideoIndex - 1 : 0;
      const videoId = SAMPLE_VIDEOS[previousVideoIndex].id;
      
      if (playedDuration.current[videoId] && playedDuration.current[videoId] > 1000) {
        sendWatchEvent(
          videoId, 
          playedDuration.current[videoId],
          videoRefs.current[previousVideoIndex]?.duration * 1000 || 30000
        );
      }
    };
  }, [currentVideoIndex]);

  // Initialize video refs
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, SAMPLE_VIDEOS.length);
  }, []);

  // Handle touch for swiping
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    
    // If swiped up significantly
    if (diff > 50) {
      handleNextVideo();
    } else if (diff < -50) {
      handlePreviousVideo();
    }
    
    touchStartY.current = null;
  };

  // Handle video navigation
  const handleNextVideo = () => {
    if (currentVideoIndex < SAMPLE_VIDEOS.length - 1) {
      // Send skip event if video is playing
      if (isPlaying) {
        sendSkipEvent(SAMPLE_VIDEOS[currentVideoIndex].id);
      }
      
      setCurrentVideoIndex(prevIndex => prevIndex + 1);
    }
  };

  const handlePreviousVideo = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(prevIndex => prevIndex - 1);
    }
  };

  // Handle play/pause
  const togglePlay = () => {
    const videoElement = videoRefs.current[currentVideoIndex];
    
    if (isPlaying) {
      videoElement.pause();
    } else {
      videoElement.play();
    }
    
    setIsPlaying(!isPlaying);
  };

  // Handle like
  const toggleLike = (videoId) => {
    const newLikeState = !isLiked[videoId];
    setIsLiked(prev => ({ ...prev, [videoId]: newLikeState }));
    
    sendLikeEvent(videoId, newLikeState);
  };

  // When video finishes, move to next
  const handleVideoEnd = () => {
    const currentVideo = videoRefs.current[currentVideoIndex];
    const videoId = SAMPLE_VIDEOS[currentVideoIndex].id;
    
    // Send watch event for completed video
    sendWatchEvent(
      videoId, 
      currentVideo.duration * 1000, // full duration in ms
      currentVideo.duration * 1000
    );
    
    // Go to next video if available
    if (currentVideoIndex < SAMPLE_VIDEOS.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    } else {
      // Loop back to first video
      setCurrentVideoIndex(0);
    }
  };

  // Post comment function
  const handleComment = (videoId) => {
    const commentText = prompt("Add your comment:");
    if (commentText && commentText.trim() !== "") {
      sendCommentEvent(videoId, commentText);
      alert("Comment posted!");
    }
  };

  // API function to send watch event
  const sendWatchEvent = async (videoId, watchDurationMs, videoDurationMs) => {
    try {
      const eventData = {
        user_id: userId,
        video_id: videoId,
        session_id: sessionId,
        watch_duration_ms: Math.round(watchDurationMs),
        video_duration_ms: Math.round(videoDurationMs),
        is_fullscreen: document.fullscreenElement !== null,
        is_autoplay: true,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screen: {
            width: window.screen.width,
            height: window.screen.height
          }
        },
        geo_location: null // You would need to implement geolocation if needed
      };
      
      const response = await fetch(`${API_URL}/events/video_watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      console.log('Watch event sent:', await response.json());
      
      // Reset played duration for this video
      playedDuration.current[videoId] = 0;
    } catch (error) {
      console.error('Error sending watch event:', error);
    }
  };

  // API function to send like event
  const sendLikeEvent = async (videoId, isLiked) => {
    try {
      const eventData = {
        user_id: userId,
        video_id: videoId,
        session_id: sessionId,
        is_liked: isLiked,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      };
      
      const response = await fetch(`${API_URL}/events/video_like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      console.log('Like event sent:', await response.json());
    } catch (error) {
      console.error('Error sending like event:', error);
    }
  };

  // API function to send comment event
  const sendCommentEvent = async (videoId, commentText) => {
    try {
      const eventData = {
        user_id: userId,
        video_id: videoId,
        session_id: sessionId,
        comment_id: `comment_${uuidv4().slice(0, 8)}`,
        comment_text: commentText,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      };
      
      const response = await fetch(`${API_URL}/events/video_comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      console.log('Comment event sent:', await response.json());
    } catch (error) {
      console.error('Error sending comment event:', error);
    }
  };

  // API function to send skip event
  const sendSkipEvent = async (videoId) => {
    try {
      const currentVideo = videoRefs.current[currentVideoIndex];
      
      const eventData = {
        user_id: userId,
        video_id: videoId,
        session_id: sessionId,
        skip_time_ms: Math.round(currentVideo.currentTime * 1000),
        skip_type: "manual",
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      };
      
      const response = await fetch(`${API_URL}/events/video_skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      console.log('Skip event sent:', await response.json());
    } catch (error) {
      console.error('Error sending skip event:', error);
    }
  };

  return (
    <div 
      className="app-container" 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="video-container">
        {SAMPLE_VIDEOS.map((video, index) => (
          <div 
            key={video.id} 
            className={`video-wrapper ${index === currentVideoIndex ? 'active' : ''}`}
            style={{ display: index === currentVideoIndex ? 'block' : 'none' }}
          >
            <video
              ref={el => videoRefs.current[index] = el}
              src={video.src}
              className="video-player"
              loop={false}
              playsInline
              autoPlay={index === currentVideoIndex}
              muted
              onClick={togglePlay}
              onEnded={handleVideoEnd}
            />
            
            <div className="video-info">
              <h3>{video.title}</h3>
              <p>{video.author}</p>
            </div>
            
            <div className="video-actions">
              <button 
                className={`action-button ${isLiked[video.id] ? 'active' : ''}`}
                onClick={() => toggleLike(video.id)}
              >
                <Heart size={28} fill={isLiked[video.id] ? "#FF2D55" : "none"} color={isLiked[video.id] ? "#FF2D55" : "white"} />
                <span>Like</span>
              </button>
              
              <button 
                className="action-button"
                onClick={() => handleComment(video.id)}
              >
                <MessageCircle size={28} />
                <span>Comment</span>
              </button>
              
              <button className="action-button">
                <Share2 size={28} />
                <span>Share</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="navigation-hint">
        <p>Swipe up for next video</p>
        <ChevronUp size={24} />
      </div>
    </div>
  );
}

export default App;