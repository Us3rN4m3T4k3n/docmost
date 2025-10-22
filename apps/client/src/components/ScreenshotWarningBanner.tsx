import React from 'react';
import './ScreenshotWarningBanner.css';

const ScreenshotWarningBanner: React.FC = () => {
  return (
    <div className="screenshot-warning-banner">
      <div className="screenshot-warning-banner-content">
        <span className="screenshot-warning-banner-icon">🚨</span>
        <span className="screenshot-warning-banner-text">
          <strong>WARNING:</strong> Screenshots are strictly prohibited and monitored. 
          Violations will result in immediate account suspension.
        </span>
        <span className="screenshot-warning-banner-icon">🚨</span>
      </div>
    </div>
  );
};

export default ScreenshotWarningBanner;

