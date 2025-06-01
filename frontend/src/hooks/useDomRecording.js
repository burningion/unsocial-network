import { useState, useCallback, useRef } from 'react';
import * as rrweb from 'rrweb';

export const useDomRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [events, setEvents] = useState([]);
  const stopFnRef = useRef(null);

  const startRecording = useCallback(() => {
    if (isRecording) return;

    setEvents([]);
    setIsRecording(true);

    stopFnRef.current = rrweb.record({
      emit(event) {
        setEvents(prevEvents => [...prevEvents, event]);
      },
      sampling: {
        scroll: 150,
        media: 800,
        input: 'last'
      },
      slimDOMOptions: {
        script: true,
        comment: true,
        headFavicon: true,
        headWhitespace: true,
        headMetaDescKeywords: true,
        headMetaSocial: true,
        headMetaRobots: true,
        headMetaHttpEquiv: true,
        headMetaAuthorship: true,
        headMetaVerification: true,
      },
    });
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !stopFnRef.current) return;

    stopFnRef.current();
    stopFnRef.current = null;
    setIsRecording(false);
  }, [isRecording]);

  const downloadRecording = useCallback(() => {
    if (events.length === 0) return;

    const recordingData = {
      events,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    const blob = new Blob([JSON.stringify(recordingData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dom-recording-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [events]);

  const clearRecording = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    isRecording,
    events,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
    hasRecording: events.length > 0
  };
};