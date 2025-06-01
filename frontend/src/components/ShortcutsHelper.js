import React, { useState } from 'react';
import './ShortcutsHelper.css';

const ShortcutsHelper = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`shortcuts-helper ${isExpanded ? 'expanded' : ''}`}>
      <button 
        className="shortcuts-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '✕' : '⌨'}
      </button>
      
      {isExpanded && (
        <div className="shortcuts-content">
          <h3>Recording Shortcuts</h3>
          <div className="shortcut-item">
            <kbd>Option</kbd> + <kbd>R</kbd>
            <span>Start/Stop recording</span>
          </div>
          <div className="shortcut-item">
            <kbd>Option</kbd> + <kbd>S</kbd>
            <span>Download recording</span>
          </div>
          <div className="shortcut-item">
            <kbd>Option</kbd> + <kbd>C</kbd>
            <span>Clear recording</span>
          </div>
          <div className="shortcut-item">
            <kbd>Option</kbd> + <kbd>V</kbd>
            <span>Toggle recording UI</span>
          </div>
          <p className="shortcut-note">Use Alt on Windows/Linux</p>
        </div>
      )}
    </div>
  );
};

export default ShortcutsHelper;