import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, Heart, MessageCircle, Share2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Sample video data - replace with your actual video sources
const SAMPLE_VIDEOS = [
  {
    id: 'video1',
    videoId: 'ef241145-7d79-4e35-b3de-396f6694f1fd',
    title: 'Nuclear Submarine',
    author: 'usgov',
  },
  {
    id: 'video2',
    videoId: '924e1b79-d64d-4655-86c8-5a9c3a9781a2',
    title: 'Spinning in the Daffodils',
    author: 'queens of the stone age',
  },
  {
    id: 'video3',
    videoId: '36b3b3e3-1e02-43e9-89bc-aebbb5325299',
    title: 'Andys line at Tampa Pro',
    author: 'and anderson',
  }
];

function App() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState({});
  const [isScrolling, setIsScrolling] = useState(false);
  const [videoSources, setVideoSources] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [sessionId] = useState(uuidv4());
  const [userId] = useState(`user_${uuidv4().slice(0, 8)}`);
  
  const videoRefs = useRef([]);
  const containerRef = useRef(null);
  const touchStartY = useRef(null);
  const startTime = useRef(null);
  const playedDuration = useRef({});
  const watchIntervalRef = useRef(null);
  const scrollTimeout = useRef(null);
  
  // API endpoint for events
  const API_URL = 'http://localhost:8000';
  
  // Initialize video refs
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, SAMPLE_VIDEOS.length);
  }, []);

  // Pre-fetch video URLs
  useEffect(() => {
    const fetchVideoUrls = async () => {
      // Fetch URLs for current and next videos
      const indicesToLoad = [currentVideoIndex];
      if (currentVideoIndex < SAMPLE_VIDEOS.length - 1) {
        indicesToLoad.push(currentVideoIndex + 1);
      }
      
      for (const index of indicesToLoad) {
        const video = SAMPLE_VIDEOS[index];
        
        // Skip if we already have this source
        if (videoSources[video.id]) continue;
        
        // Mark as loading
        setLoadingStates(prev => ({ ...prev, [video.id]: true }));
        
        try {
          // For iOS compatibility, use a special video URL approach
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          
          if (isIOS) {
            // On iOS, we'll add a timestamp to bust cache and avoid redirects
            const timestamp = Date.now();
            const iosCompatUrl = `https://api.video-jungle.com/v/${video.videoId}?_t=${timestamp}`;
            
            setVideoSources(prev => ({ ...prev, [video.id]: iosCompatUrl }));
          } else {
            // On other platforms, we can use the URL directly
            setVideoSources(prev => ({ ...prev, [video.id]: `https://api.video-jungle.com/v/${video.videoId}` }));
          }
        } catch (error) {
          console.error(`Error fetching video URL for ${video.id}:`, error);
        } finally {
          setLoadingStates(prev => ({ ...prev, [video.id]: false }));
        }
      }
    };
    
    fetchVideoUrls();
  }, [currentVideoIndex, videoSources]);

  // Setup video playback for the current video
  useEffect(() => {
    const setupCurrentVideo = async () => {
      // Pause all videos first
      videoRefs.current.forEach(video => {
        if (video) {
          video.pause();
          // Important for iOS: remove src to stop background loading
          if (video !== videoRefs.current[currentVideoIndex]) {
            // Store current time to resume later if needed
            video.dataset.currentTime = video.currentTime;
          }
        }
      });
      
      // Then play the current one
      const currentVideo = videoRefs.current[currentVideoIndex];
      const currentVideoData = SAMPLE_VIDEOS[currentVideoIndex];
      
      if (currentVideo && videoSources[currentVideoData.id]) {
        // For iOS compatibility
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // Ensure video has the correct attributes for iOS
        if (isIOS) {
          currentVideo.setAttribute('playsinline', '');
          currentVideo.setAttribute('webkit-playsinline', '');
          currentVideo.muted = true;
          currentVideo.setAttribute('muted', '');
          currentVideo.setAttribute('autoplay', '');
        }
        
        // Set src if not already set
        if (currentVideo.src !== videoSources[currentVideoData.id]) {
          currentVideo.src = videoSources[currentVideoData.id];
          currentVideo.load();
        }
        
        // Reset to beginning if needed
        currentVideo.currentTime = 0;
        
        if (isPlaying) {
          try {
            const playPromise = currentVideo.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                console.error("Video play error:", error);
                
                // Special handling for iOS
                if (isIOS) {
                  // For iOS, unmuting might help with autoplay
                  currentVideo.muted = true;
                  currentVideo.play().catch(err => console.error("Second play attempt failed:", err));
                }
              });
            }
          } catch (err) {
            console.error("Error playing video:", err);
          }
        }
      }
    };
    
    setupCurrentVideo();
  }, [currentVideoIndex, isPlaying, videoSources]);

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

  // Add wheel event listener for desktop scrolling
  useEffect(() => {
    const handleWheel = (e) => {
      if (isScrolling) return;
      
      // Prevent the default scroll behavior
      e.preventDefault();
      
      // Determine scroll direction
      if (e.deltaY > 0) {
        // Scrolling down - next video
        handleNextVideo();
      } else if (e.deltaY < 0) {
        // Scrolling up - previous video
        handlePreviousVideo();
      }
      
      // Set scrolling flag to prevent rapid scrolling
      setIsScrolling(true);
      
      // Clear any existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      
      // Set a timeout to reset the scrolling flag
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, 800); // Adjust timing as needed for smoothness
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [isScrolling]);

  // Improved touch handling for mobile swipes
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    // Prevent default to stop browser scrolling
    e.preventDefault();
  };

  const handleTouchEnd = (e) => {
    if (touchStartY.current === null || isScrolling) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    
    // Set threshold for swipe detection (adjust as needed)
    const swipeThreshold = 50;
    
    // If swiped significantly
    if (Math.abs(diff) > swipeThreshold) {
      setIsScrolling(true);
      
      if (diff > 0) {
        // Swiped up - next video
        handleNextVideo();
      } else {
        // Swiped down - previous video
        handlePreviousVideo();
      }
      
      // Reset scrolling after a delay
      setTimeout(() => {
        setIsScrolling(false);
      }, 800);
    }
    
    touchStartY.current = null;
  };

  // Video navigation functions
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

  // Toggle play/pause
  const togglePlay = () => {
    const videoElement = videoRefs.current[currentVideoIndex];
    
    if (videoElement) {
      if (isPlaying) {
        videoElement.pause();
      } else {
        videoElement.play().catch(err => console.error("Play error:", err));
      }
      
      setIsPlaying(!isPlaying);
    }
  };

  // Handle video end
  const handleVideoEnd = () => {
    const currentVideo = videoRefs.current[currentVideoIndex];
    const videoId = SAMPLE_VIDEOS[currentVideoIndex].id;
    
    // Send watch event for completed video
    if (currentVideo && currentVideo.duration) {
      sendWatchEvent(
        videoId, 
        currentVideo.duration * 1000, // full duration in ms
        currentVideo.duration * 1000
      );
    }
    
    // Go to next video if available
    if (currentVideoIndex < SAMPLE_VIDEOS.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    } else {
      // Loop back to first video
      setCurrentVideoIndex(0);
    }
  };

  // Handle video error - important for iOS
  const handleVideoError = (index) => {
    console.error(`Video error for index ${index}`);
    
    const video = videoRefs.current[index];
    const videoData = SAMPLE_VIDEOS[index];
    
    if (video && videoData) {
      // Try to recover - especially important for iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      
      if (isIOS) {
        // For iOS, we need to use a different approach when errors occur
        // Add a random query parameter to bust cache
        const timestamp = Date.now();
        const newUrl = `https://api.video-jungle.com/v/${videoData.videoId}?_t=${timestamp}`;
        
        // Update the source
        setVideoSources(prev => ({ ...prev, [videoData.id]: newUrl }));
        
        // Force muted playback for iOS (required for autoplay)
        video.muted = true;
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        
        // Load and try to play again
        setTimeout(() => {
          video.load();
          if (index === currentVideoIndex && isPlaying) {
            video.play().catch(e => console.error("Recovery play failed:", e));
          }
        }, 100);
      }
    }
  };

  // API endpoints (unchanged from your original code)
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
        geo_location: null
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

  const sendSkipEvent = async (videoId) => {
    try {
      const currentVideo = videoRefs.current[currentVideoIndex];
      
      if (currentVideo) {
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
      }
    } catch (error) {
      console.error('Error sending skip event:', error);
    }
  };

  // Toggle like functionality
  const toggleLike = (videoId) => {
    const newLikeState = !isLiked[videoId];
    setIsLiked(prev => ({ ...prev, [videoId]: newLikeState }));
    
    sendLikeEvent(videoId, newLikeState);
  };

  // Post comment function
  const handleComment = (videoId) => {
    const commentText = prompt("Add your comment:");
    if (commentText && commentText.trim() !== "") {
      sendCommentEvent(videoId, commentText);
      alert("Comment posted!");
    }
  };

  // Video playback overlay
  const renderPlaybackOverlay = () => {
    return (
      <div 
        className="playback-overlay"
        onClick={togglePlay}
      >
        {!isPlaying && (
          <div className="play-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="app-container" 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="video-container">
        {SAMPLE_VIDEOS.map((video, index) => {
          const videoSource = videoSources[video.id];
          const isLoading = loadingStates[video.id];
          
          return (
            <div 
              key={video.id} 
              className={`video-wrapper ${index === currentVideoIndex ? 'active' : ''}`}
              style={{ 
                display: index === currentVideoIndex ? 'block' : 'none',
              }}
            >
              {isLoading && <div className="video-loader">Loading...</div>}
              
              {videoSource && (
                <>
                  <video
                    ref={el => videoRefs.current[index] = el}
                    src={videoSource}
                    className="video-player"
                    loop={false}
                    playsInline
                    webkit-playsinline="true"
                    muted
                    preload="auto"
                    onEnded={handleVideoEnd}
                    onError={() => handleVideoError(index)}
                  />
                  
                  {index === currentVideoIndex && renderPlaybackOverlay()}
                </>
              )}
              
              <div className="video-info">
                <h3>{video.title}</h3>
                <p>{video.author}</p>
              </div>
              
              <div className="video-actions">
                <button 
                  className={`action-button ${isLiked[video.id] ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(video.id);
                  }}
                >
                  <Heart size={28} fill={isLiked[video.id] ? "#FF2D55" : "none"} color={isLiked[video.id] ? "#FF2D55" : "white"} />
                  <span>Like</span>
                </button>
                
                <button 
                  className="action-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleComment(video.id);
                  }}
                >
                  <MessageCircle size={28} />
                  <span>Comment</span>
                </button>
                
                <button 
                  className="action-button"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Share2 size={28} />
                  <span>Share</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="navigation-hint">
        <p>Swipe up for next video</p>
        <ChevronUp size={24} />
      </div>
    </div>
  );
}

export default App;