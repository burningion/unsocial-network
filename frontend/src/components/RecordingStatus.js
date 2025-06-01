import React from 'react';
import './RecordingStatus.css';

const RecordingStatus = ({ 
  isRecording, 
  hasRecording,
  onStartRecording,
  onStopRecording,
  onDownload,
  onClear,
  hideControls = false
}) => {
  if ((!isRecording && !hasRecording) || hideControls) return null;

  return (
    <div className="recording-status">
      {isRecording ? (
        <>
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            Recording
          </div>
          <button className="recording-button stop" onClick={onStopRecording}>
            Stop Recording
          </button>
        </>
      ) : hasRecording ? (
        <>
          <div className="recording-info">
            Recording saved
          </div>
          <div className="recording-actions">
            <button className="recording-button download" onClick={onDownload}>
              Download
            </button>
            <button className="recording-button clear" onClick={onClear}>
              Clear
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default RecordingStatus;