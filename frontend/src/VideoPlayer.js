import React, { useState, useRef, useEffect } from 'react';

// Sample component showing video loading logic
const VideoPlayer = ({ videoId }) => {
  const [videoUrl, setVideoUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  // Fetch the actual video URL by following the redirect
  useEffect(() => {
    const fetchVideoUrl = async () => {
      try {
        setIsLoading(true);
        
        // First, fetch the URL but don't follow redirects
        const response = await fetch(`https://api.video-jungle.com/v/${videoId}`, {
          method: 'GET',
          redirect: 'manual' // Don't automatically follow redirects
        });
        
        // If we got a redirect, get the Location header
        if (response.type === 'opaqueredirect' || response.status === 0) {
          // For security reasons, browsers may not expose the redirect URL directly
          // In this case, we'll use a different approach
          
          // Try with XMLHttpRequest which can track redirects in some browsers
          const xhr = new XMLHttpRequest();
          xhr.open('GET', `https://api.video-jungle.com/v/${videoId}`, true);
          
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              if (xhr.status >= 200 && xhr.status < 300) {
                // Direct success - unlikely with your redirect setup
                setVideoUrl(xhr.responseURL || `https://api.video-jungle.com/v/${videoId}`);
              } else {
                // For iOS, sometimes we have to just use the original URL and let iOS
                // handle it specially via the video element
                setVideoUrl(`https://api.video-jungle.com/v/${videoId}`);
              }
              setIsLoading(false);
            }
          };
          
          xhr.send();
        } else if (response.redirected) {
          // If browser allowed us to see the redirect
          setVideoUrl(response.url);
          setIsLoading(false);
        } else {
          // Just use the original URL as fallback
          setVideoUrl(`https://api.video-jungle.com/v/${videoId}`);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error fetching video:", err);
        setError(err.message);
        setIsLoading(false);
        
        // Fallback to original URL
        setVideoUrl(`https://api.video-jungle.com/v/${videoId}`);
      }
    };

    fetchVideoUrl();
  }, [videoId]);

  // Special handling for iOS
  useEffect(() => {
    const videoElement = videoRef.current;
    
    if (videoElement && videoUrl) {
      // For iOS specific handling
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      
      if (isIOS) {
        // Add event listeners to track loading issues
        const handleError = (e) => {
          console.error("Video error:", e);
          
          // If we get an error, try with a different approach
          // Some iOS versions require playsinline + muted + autoplay
          videoElement.setAttribute('playsinline', '');
          videoElement.muted = true;
          videoElement.load();
          
          // Try to play after a short delay
          setTimeout(() => {
            videoElement.play().catch(err => console.error("Playback error:", err));
          }, 100);
        };
        
        videoElement.addEventListener('error', handleError);
        return () => videoElement.removeEventListener('error', handleError);
      }
    }
  }, [videoUrl]);

  if (isLoading) {
    return <div>Loading video...</div>;
  }

  if (error) {
    return <div>Error loading video: {error}</div>;
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      controls={false}
      playsInline 
      muted
      autoPlay
      className="video-player"
      onClick={(e) => e.target.paused ? e.target.play() : e.target.pause()}
    />
  );
};

export default VideoPlayer;