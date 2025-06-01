import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Heart, MessageCircle, Share2, X, Maximize, ChevronUp } from 'lucide-react';
import './VideoFeed.css';

// Conditionally import recording-related modules
const recordingEnabled = process.env.REACT_APP_ENABLE_RECORDING === 'true';
const useDomRecording = recordingEnabled 
  ? require('./hooks/useDomRecording').useDomRecording 
  : () => ({
      isRecording: false,
      events: [],
      startRecording: () => {},
      stopRecording: () => {},
      downloadRecording: () => {},
      clearRecording: () => {},
      hasRecording: false
    });

const RecordingStatus = recordingEnabled 
  ? require('./components/RecordingStatus').default 
  : () => null;

const ShortcutsHelper = recordingEnabled
  ? require('./components/ShortcutsHelper').default
  : () => null;

// Event tracking utility
const sendEvent = async (eventType, eventData) => {
  try {
    const response = await fetch(`http://localhost:8000/events/${eventType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });
    
    if (!response.ok) {
      console.error(`Error sending ${eventType} event:`, await response.text());
    }
    return response.ok;
  } catch (error) {
    console.error(`Failed to send ${eventType} event:`, error);
    return false;
  }
};

const VideoFeed = ({ videos = [], isLoading = false }) => {
  // Use sample videos if none provided
  const videoData = useMemo(() => {
    if (videos.length > 0) return videos;
    
    return [
      {
        id: 'video1',
        videoId: 'ef241145-7d79-4e35-b3de-396f6694f1fd',
        title: 'Dancing in the Rain',
        author: 'dance_lover92',
      },
      {
        id: 'video2',
        videoId: '924e1b79-d64d-4655-86c8-5a9c3a9781a2',
        title: 'Skateboard Tricks',
        author: 'sk8ter_boi',
      },
      {
        id: 'video3',
        videoId: '36b3b3e3-1e02-43e9-89bc-aebbb5325299',
        title: 'Cooking with Chef Max',
        author: 'chef_max_official',
      },
      {
        id: 'video4',
        videoId: 'ef241145-7d79-4e35-b3de-396f6694f1fd',
        title: 'Street Photography',
        author: 'urban_lens',
      },
      {
        id: 'video5',
        videoId: '924e1b79-d64d-4655-86c8-5a9c3a9781a2',
        title: 'Morning Yoga Flow',
        author: 'yoga_with_jen',
      }
    ];
  }, [videos]);
  
  // State management
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState({});
  const [likes, setLikes] = useState({});
  const [isMiniPlayerActive, setIsMiniPlayerActive] = useState(false);
  const [miniPlayerVideoIndex, setMiniPlayerVideoIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);
  const [isStickyMode, setIsStickyMode] = useState(false);
  const [showRecordingUI, setShowRecordingUI] = useState(false); // Hidden by default
  
  // Refs
  const videoRefs = useRef([]);
  const miniPlayerRef = useRef(null);
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const touchStartY = useRef(null);
  const scrollTimeoutRef = useRef(null);
  
  // DOM Recording hook
  const {
    isRecording,
    events,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
    hasRecording
  } = useDomRecording();
  
  // Initialize video refs and set default playing state
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, videoData.length);
    
    // Set initial playing state 
    const initialPlayingState = {};
    videoData.forEach(video => {
      initialPlayingState[video.id] = true;
    });
    setIsPlaying(initialPlayingState);
    
    // Play the first video on load
    if (videoData.length > 0 && videoRefs.current[0]) {
      const firstVideo = videoRefs.current[0];
      setTimeout(() => {
        firstVideo.play().catch(error => {
          console.error("Error playing first video:", error);
          // Try with muted for autoplay policies
          firstVideo.muted = true;
          firstVideo.play().catch(err => console.error("Second play attempt failed:", err));
        });
      }, 100);
    }
  }, [videoData]);

  // Set up intersection observer for scroll detection
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    // Options for the observer
    const options = {
      root: containerRef.current,
      rootMargin: '0px',
      threshold: 0.5 // 50% of the element must be visible
    };
    
    // Create observer to detect which video is most visible
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          const index = parseInt(entry.target.dataset.index, 10);
          if (!isNaN(index) && index !== currentVideoIndex) {
            setCurrentVideoIndex(index);
          }
        }
      });
    }, options);
    
    // Observe all video wrappers
    const videoWrappers = containerRef.current.querySelectorAll('.videoWrapper');
    videoWrappers.forEach(wrapper => {
      observerRef.current.observe(wrapper);
    });
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [videoData, currentVideoIndex]);
  
  // Handle playing the current video and pausing others
  useEffect(() => {
    videoRefs.current.forEach((videoRef, i) => {
      if (!videoRef) return;
      
      const videoId = videoData[i]?.id;
      const video = videoData[i];
      if (!videoId || !video) return;
      
      if (i === currentVideoIndex) {
        if (isPlaying[videoId]) {
          videoRef.play()
            .then(() => {
              // Send video_watch event when a new video starts playing
              sendEvent('video_watch', {
                user_id: localStorage.getItem('userId') || 'anonymous',
                video_id: video.videoId,
                watch_duration_ms: 0, // Just started watching
                video_duration_ms: Math.floor((videoRef.duration || 0) * 1000),
                is_autoplay: true // This is triggered by auto-playback
              });
            })
            .catch(err => {
              console.error("Video play error:", err);
              videoRef.muted = true;
              videoRef.play().catch(e => console.error("Second play attempt failed:", e));
            });
        }
      } else {
        // If we're pausing a video that was playing, send a watch event with current duration
        if (isPlaying[videoId] && !videoRef.paused) {
          sendEvent('video_watch', {
            user_id: localStorage.getItem('userId') || 'anonymous',
            video_id: video.videoId,
            watch_duration_ms: Math.floor(videoRef.currentTime * 1000),
            video_duration_ms: Math.floor((videoRef.duration || 0) * 1000),
            is_autoplay: false
          });
        }
        
        // Ensure that all other videos are definitely paused
        videoRef.pause();
        
        // Additionally, reset other videos to the start
        // This gives a cleaner experience when revisiting videos
        if (Math.abs(i - currentVideoIndex) > 1) {
          videoRef.currentTime = 0;
        }
      }
    });
  }, [currentVideoIndex, isPlaying, videoData]);
  
  // Handle scroll events for improved full-page scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;
      
      // Detect scroll direction
      const isScrollingDown = scrollTop > lastScrollPosition;
      setLastScrollPosition(scrollTop);
      
      // Find the index of current video based on scroll position
      const currentIndex = Math.floor(scrollTop / viewportHeight);
      
      // New approach: Don't show mini player at all when scrolling between videos
      // This simplifies the UX and ensures only one video plays at a time
      
      // Always deactivate mini player when scrolling to a new video
      if (isMiniPlayerActive) {
        setIsMiniPlayerActive(false);
        setIsStickyMode(false);
      }
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set scrolling state
      setIsScrolling(true);
      
      // Reset scrolling state after scrolling stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [lastScrollPosition, isMiniPlayerActive, miniPlayerVideoIndex]);
  
  // Handle touch events for swipe navigation
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };
  
  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY.current - touchEndY;
    const swipeThreshold = 75; // Minimum distance to be considered a swipe
    
    if (Math.abs(deltaY) > swipeThreshold) {
      // Check if we're swiping up or down
      if (deltaY > 0) {
        // Swipe up - next video
        goToNextVideo();
      } else {
        // Swipe down - previous video
        goToPreviousVideo();
      }
    }
    
    touchStartY.current = null;
  };
  
  // Navigation functions
  const goToNextVideo = useCallback(() => {
    if (currentVideoIndex < videoData.length - 1) {
      // Before moving to next video, send a skip event for the current video
      const currentVideo = videoData[currentVideoIndex];
      const videoElement = videoRefs.current[currentVideoIndex];
      
      if (currentVideo && videoElement) {
        sendEvent('video_skip', {
          user_id: localStorage.getItem('userId') || 'anonymous',
          video_id: currentVideo.videoId,
          skip_time_ms: Math.floor(videoElement.currentTime * 1000),
          skip_type: 'swipe'
        });
      }
      
      setCurrentVideoIndex(prevIndex => prevIndex + 1);
      
      // Scroll to the next video
      if (containerRef.current) {
        const nextVideoPosition = containerRef.current.clientHeight * (currentVideoIndex + 1);
        containerRef.current.scrollTo({
          top: nextVideoPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [currentVideoIndex, videoData]);
  
  const goToPreviousVideo = useCallback(() => {
    if (currentVideoIndex > 0) {
      // Before moving to previous video, send a skip event for the current video
      const currentVideo = videoData[currentVideoIndex];
      const videoElement = videoRefs.current[currentVideoIndex];
      
      if (currentVideo && videoElement) {
        sendEvent('video_skip', {
          user_id: localStorage.getItem('userId') || 'anonymous',
          video_id: currentVideo.videoId,
          skip_time_ms: Math.floor(videoElement.currentTime * 1000),
          skip_type: 'swipe-back'
        });
      }
      
      setCurrentVideoIndex(prevIndex => prevIndex - 1);
      
      // Scroll to the previous video
      if (containerRef.current) {
        const prevVideoPosition = containerRef.current.clientHeight * (currentVideoIndex - 1);
        containerRef.current.scrollTo({
          top: prevVideoPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [currentVideoIndex, videoData]);
  
  // Handle when video ends
  const handleVideoEnd = useCallback(() => {
    const video = videoData[currentVideoIndex];
    const videoElement = videoRefs.current[currentVideoIndex];
    
    if (video && videoElement) {
      // Send video_watch event with complete viewing
      sendEvent('video_watch', {
        user_id: localStorage.getItem('userId') || 'anonymous',
        video_id: video.videoId,
        watch_duration_ms: Math.floor(videoElement.duration * 1000),
        video_duration_ms: Math.floor(videoElement.duration * 1000),
        is_autoplay: false
      });
    }
    
    // Automatically play the next video
    goToNextVideo();
  }, [goToNextVideo, videoData, currentVideoIndex]);
  
  // Toggle play/pause for a specific video
  const togglePlay = (videoId, index) => {
    const videoElement = videoRefs.current[index];
    const video = videoData[index];
    
    setIsPlaying(prev => {
      const newState = {
        ...prev,
        [videoId]: !prev[videoId]
      };
      
      if (videoElement) {
        if (newState[videoId]) {
          videoElement.play()
            .then(() => {
              // Send video_watch event when playing starts
              if (video) {
                sendEvent('video_watch', {
                  user_id: localStorage.getItem('userId') || 'anonymous',
                  video_id: video.videoId,
                  watch_duration_ms: 0, // Just started
                  video_duration_ms: Math.floor((videoElement.duration || 0) * 1000),
                  is_autoplay: false
                });
              }
            })
            .catch(err => console.error("Play error:", err));
        } else {
          videoElement.pause();
          
          // Send video_skip event when pausing
          if (video) {
            sendEvent('video_skip', {
              user_id: localStorage.getItem('userId') || 'anonymous',
              video_id: video.videoId,
              skip_time_ms: Math.floor(videoElement.currentTime * 1000),
              skip_type: 'manual'
            });
          }
        }
      }
      
      return newState;
    });
  };
  
  // Toggle like for a video
  const toggleLike = (videoId) => {
    const index = videoData.findIndex(v => v.id === videoId);
    const video = index !== -1 ? videoData[index] : null;
    
    setLikes(prev => {
      const newLikeState = !prev[videoId];
      
      // Send like event to backend
      if (video) {
        sendEvent('video_like', {
          user_id: localStorage.getItem('userId') || 'anonymous',
          video_id: video.videoId,
          is_liked: newLikeState
        });
      }
      
      return {
        ...prev,
        [videoId]: newLikeState
      };
    });
  };
  
  // Handle comment and share actions
  const handleComment = (videoId) => {
    console.log(`Comment on video ${videoId}`);
    
    const index = videoData.findIndex(v => v.id === videoId);
    const video = index !== -1 ? videoData[index] : null;
    
    if (video) {
      // Generate a unique comment ID
      const commentId = `comment-${Date.now()}`;
      
      // Send comment event
      sendEvent('video_comment', {
        user_id: localStorage.getItem('userId') || 'anonymous',
        video_id: video.videoId,
        comment_id: commentId,
        comment_text: "User commented" // In a real app, this would be the actual comment text
      });
    }
  };
  
  const handleShare = (videoId) => {
    console.log(`Share video ${videoId}`);
    
    // For shares, we're using the video_watch event type with a special flag
    // An alternative would be to add a VIDEO_SHARE event type in the backend
    const index = videoData.findIndex(v => v.id === videoId);
    const video = index !== -1 ? videoData[index] : null;
    
    if (video) {
      // Send share event (using watch event with custom data)
      sendEvent('video_watch', {
        user_id: localStorage.getItem('userId') || 'anonymous',
        video_id: video.videoId,
        watch_duration_ms: 0,
        video_duration_ms: 0,
        is_autoplay: false,
        is_share: true // Custom field to indicate this is a share event
      });
    }
  };
  
  // Close the mini player
  const closeMiniPlayer = () => {
    setIsMiniPlayerActive(false);
    setIsStickyMode(false);
  };
  
  // Expand mini player to full screen
  const expandMiniPlayer = () => {
    setCurrentVideoIndex(miniPlayerVideoIndex);
    setIsMiniPlayerActive(false);
    
    // Scroll to the selected video
    if (containerRef.current) {
      const videoPosition = containerRef.current.clientHeight * miniPlayerVideoIndex;
      containerRef.current.scrollTo({
        top: videoPosition,
        behavior: 'smooth'
      });
    }
  };
  
  // Detect if device is iOS
  const isIOS = useMemo(() => {
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';
    return /iPhone|iPad|iPod/i.test(userAgent);
  }, []);
  
  // Debug logging for recording status
  useEffect(() => {
    console.log('Recording enabled:', recordingEnabled);
    console.log('REACT_APP_ENABLE_RECORDING:', process.env.REACT_APP_ENABLE_RECORDING);
  }, [recordingEnabled]);

  // Keyboard shortcuts for recording
  useEffect(() => {
    console.log('Setting up keyboard shortcuts. Recording enabled:', recordingEnabled);
    
    if (!recordingEnabled) {
      console.log('Recording disabled - keyboard shortcuts not activated');
      return;
    }
    
    const handleKeyPress = (e) => {
      // Log all keypress events to debug
      console.log('Key pressed:', {
        key: e.key,
        altKey: e.altKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        code: e.code
      });
      
      // Use Alt/Option key to avoid conflicts
      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        console.log('Alt key combo detected, code:', e.code);
        
        // Use e.code instead of e.key to avoid special character issues on macOS
        switch(e.code) {
          case 'KeyR':
            e.preventDefault();
            console.log('Alt+R pressed. isRecording:', isRecording);
            if (isRecording) {
              stopRecording();
            } else {
              startRecording();
            }
            break;
          case 'KeyS':
            e.preventDefault();
            console.log('Alt+S pressed. isRecording:', isRecording, 'hasRecording:', hasRecording);
            if (isRecording) {
              stopRecording();
              // Use setTimeout to ensure state has updated before downloading
              setTimeout(() => {
                downloadRecording();
              }, 100);
            } else if (hasRecording) {
              downloadRecording();
            }
            break;
          case 'KeyC':
            e.preventDefault();
            console.log('Alt+C pressed. hasRecording:', hasRecording, 'isRecording:', isRecording);
            if (hasRecording && !isRecording) {
              clearRecording();
            }
            break;
          case 'KeyV':
            e.preventDefault();
            console.log('Alt+V pressed. Current showRecordingUI:', showRecordingUI);
            setShowRecordingUI(prev => !prev);
            break;
          default:
            console.log('Unhandled Alt+ code:', e.code, 'key:', e.key);
            break;
        }
      }
    };
    
    console.log('Adding keydown event listener');
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      console.log('Removing keydown event listener');
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isRecording, hasRecording, startRecording, stopRecording, downloadRecording, clearRecording, recordingEnabled, showRecordingUI]);

  return (
    <div className="app">
      {isLoading ? (
        <div className="loadingContainer">Loading videos...</div>
      ) : (
        <>
          <div 
            className="videoContainer"
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {videoData.map((video, index) => (
              <div 
                key={video.id || index}
                className={`videoWrapper ${index === currentVideoIndex ? 'active' : ''}`}
                data-videoid={video.id}
                data-index={index}
              >
                <video
                  ref={el => videoRefs.current[index] = el}
                  src={`https://api.video-jungle.com/v/${video.videoId}`}
                  className="videoPlayer"
                  loop
                  playsInline
                  muted
                  preload="auto"
                  onEnded={handleVideoEnd}
                />
                
                {/* Playback overlay */}
                <div 
                  className="playbackOverlay"
                  onClick={() => togglePlay(video.id, index)}
                >
                  {!isPlaying[video.id] && (
                    <div className="playIcon">
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Video info */}
                <div className="videoInfo">
                  <h3>{video.title || `Video ${index + 1}`}</h3>
                  <p>{video.author || 'Unknown author'}</p>
                </div>
                
                {/* Video actions */}
                <div className="videoActions">
                  <button 
                    className={`actionButton ${likes[video.id] ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(video.id);
                    }}
                  >
                    <Heart 
                      size={28} 
                      fill={likes[video.id] ? "#FF2D55" : "none"} 
                      color={likes[video.id] ? "#FF2D55" : "white"} 
                    />
                    <span>Like</span>
                  </button>
                  
                  <button 
                    className="actionButton"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleComment(video.id);
                    }}
                  >
                    <MessageCircle size={28} />
                    <span>Comment</span>
                  </button>
                  
                  <button 
                    className="actionButton"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(video.id);
                    }}
                  >
                    <Share2 size={28} />
                    <span>Share</span>
                  </button>
                </div>
                
                {/* Scroll indicator - only show on first video */}
                {index === 0 && (
                  <div className="scrollIndicator">
                    <ChevronUp size={24} />
                    <p>Swipe up for next video</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Mini Player functionality removed for cleaner UX */}
          
          {/* Upload section - fixed at bottom */}
          <div className="uploadSection">
            <button className="uploadButton">
              Upload new video
            </button>
          </div>
          
          {/* Recording status - hidden by default, toggle with Cmd+V */}
          <RecordingStatus 
            isRecording={isRecording}
            hasRecording={hasRecording}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onDownload={downloadRecording}
            onClear={clearRecording}
            hideControls={!showRecordingUI}
          />
          
          {/* Keyboard shortcuts helper */}
          <ShortcutsHelper />
        </>
      )}
    </div>
  );
};

export default VideoFeed;