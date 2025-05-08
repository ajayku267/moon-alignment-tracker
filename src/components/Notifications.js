import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useMoonData } from '../context/MoonDataContext';
import './Notifications.css';

const Notifications = () => {
  const { 
    notifications, 
    hasNewNotifications, 
    darkMode, 
    actions
  } = useMoonData();
  
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Blink notification icon when new notifications arrive
  useEffect(() => {
    let blinkInterval;
    
    if (hasNewNotifications && !showNotifications) {
      blinkInterval = setInterval(() => {
        const notificationIcon = document.querySelector('.notification-icon');
        if (notificationIcon) {
          notificationIcon.classList.toggle('blink');
        }
      }, 500);
    }
    
    return () => {
      if (blinkInterval) {
        clearInterval(blinkInterval);
      }
    };
  }, [hasNewNotifications, showNotifications]);
  
  // Mark notifications as read when panel is opened
  useEffect(() => {
    if (showNotifications && hasNewNotifications) {
      actions.markNotificationsAsRead();
    }
  }, [showNotifications, hasNewNotifications, actions]);
  
  // Toggle notifications panel
  const toggleNotifications = () => {
    setShowNotifications(prev => !prev);
  };
  
  // Clear all notifications
  const handleClearAll = (e) => {
    e.stopPropagation();
    actions.clearNotifications();
  };
  
  // Dismiss a single notification
  const handleDismiss = (e, id) => {
    e.stopPropagation();
    actions.dismissNotification(id);
  };
  
  // Format relative time
  const getRelativeTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    
    return format(new Date(timestamp), 'MMM dd');
  };

  return (
    <div className={`notifications-wrapper ${darkMode ? 'dark-mode' : ''}`}>
      <button 
        className={`notification-icon ${hasNewNotifications ? 'has-new' : ''}`}
        onClick={toggleNotifications}
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <path fill="none" d="M0 0h24v24H0z"/>
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
        </svg>
        {notifications.length > 0 && (
          <span className="notification-badge">{notifications.length}</span>
        )}
      </button>
      
      {showNotifications && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <h3>Notifications</h3>
            <button 
              className="clear-all-btn" 
              onClick={handleClearAll}
              disabled={notifications.length === 0}
            >
              Clear All
            </button>
          </div>
          
          <div className="notifications-list">
            {notifications.length > 0 ? (
              notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`notification-item ${notification.type}`}
                >
                  <div className="notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {getRelativeTime(notification.timestamp)}
                    </span>
                  </div>
                  <button 
                    className="dismiss-btn"
                    onClick={(e) => handleDismiss(e, notification.id)}
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-notifications">
                <p>No notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications; 