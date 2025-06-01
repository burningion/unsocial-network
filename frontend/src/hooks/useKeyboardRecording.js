import { useState, useEffect, useCallback, useRef } from 'react';
import { record } from 'rrweb';

export const useKeyboardRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [notification, setNotification] = useState(null);
  const stopFnRef = useRef(null);
  const eventsRef = useRef([]);

  const showNotification = useCallback((message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording) {
      showNotification('Already recording!', 'warning');
      return;
    }

    setIsRecording(true);
    setEventCount(0);
    eventsRef.current = [];
    
    showNotification('Recording started', 'success');

    stopFnRef.current = record({
      emit(event) {
        eventsRef.current.push(event);
        setEventCount(prev => prev + 1);
      },
    });
  }, [isRecording, showNotification]);

  const stopAndSave = useCallback(() => {
    if (!isRecording || !stopFnRef.current) {
      showNotification('Not recording', 'error');
      return;
    }

    stopFnRef.current();
    setIsRecording(false);

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `demo-recording-${timestamp}.json`;
    
    const blob = new Blob([JSON.stringify(eventsRef.current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    showNotification(`Recording saved as ${filename}`, 'success');
    setEventCount(0);
    eventsRef.current = [];
  }, [isRecording, showNotification]);

  const cancelRecording = useCallback(() => {
    if (!isRecording || !stopFnRef.current) {
      showNotification('Not recording', 'error');
      return;
    }

    stopFnRef.current();
    setIsRecording(false);
    setEventCount(0);
    eventsRef.current = [];
    showNotification('Recording cancelled', 'info');
  }, [isRecording, showNotification]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toUpperCase()) {
          case 'R':
            e.preventDefault();
            startRecording();
            break;
          case 'S':
            e.preventDefault();
            stopAndSave();
            break;
          case 'X':
            e.preventDefault();
            cancelRecording();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startRecording, stopAndSave, cancelRecording]);

  return {
    isRecording,
    eventCount,
    notification,
    startRecording,
    stopAndSave,
    cancelRecording,
  };
};