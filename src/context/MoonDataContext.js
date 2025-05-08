import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { getDefaultData, generateMoonData } from '../data/moonData';

// Create the context
const MoonDataContext = createContext();

// Worker instance
let worker = null;

// Provider component
export const MoonDataProvider = ({ children }) => {
  const [moonData, setMoonData] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [simultaneousAlignments, setSimultaneousAlignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: subDays(new Date(), 7),
    endDate: new Date(),
    location: null,
    angleThreshold: null,
    visibilityThreshold: 0.2,
  });
  const [processingStats, setProcessingStats] = useState({
    processingTime: 0,
    dataPoints: 0,
    mappedDataPoints: 0,
    resultItems: 0,
  });
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  // Initialize web worker
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Create a blob URL for the worker
      const workerBlob = new Blob(
        [`importScripts('${window.location.origin}/workers/moonDataWorker.js');`],
        { type: 'application/javascript' }
      );
      worker = new Worker(URL.createObjectURL(workerBlob));
      
      // Set up message handler
      worker.onmessage = (e) => {
        const { type, processedData, simultaneousAlignments, ...stats } = e.data;
        
        if (type === 'result') {
          setProcessedData(processedData);
          
          // Check for new simultaneous alignments and create notifications
          if (simultaneousAlignments && simultaneousAlignments.length > 0) {
            const previousAlignmentIds = new Set(
              simultaneousAlignments.map(a => `${a.timeKey}_${a.locations.join('_')}`)
            );
            
            // Find new alignments that weren't in the previous set
            const newAlignments = simultaneousAlignments.filter(alignment => {
              const alignmentId = `${alignment.timeKey}_${alignment.locations.join('_')}`;
              return !previousAlignmentIds.has(alignmentId);
            });
            
            // Create notifications for new alignments
            if (newAlignments.length > 0) {
              const newNotifications = newAlignments.map(alignment => ({
                id: `alignment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'alignment',
                title: 'New Simultaneous Alignment Detected!',
                message: `${alignment.locationNames.join(', ')} show simultaneous moon alignments`,
                timestamp: Date.now(),
                data: alignment
              }));
              
              setNotifications(prev => [...newNotifications, ...prev].slice(0, 20)); // Keep last 20 notifications
              setHasNewNotifications(true);
            }
          }
          
          setSimultaneousAlignments(simultaneousAlignments);
          setProcessingStats(stats);
          setIsLoading(false);
        } else if (type === 'generated') {
          setMoonData(e.data.data);
          setIsLoading(false);
        } else if (type === 'error') {
          setError(e.data.message);
          setIsLoading(false);
        }
      };
      
      // Initial data load
      generateInitialData();
      
      // Cleanup worker on unmount
      return () => {
        if (worker) {
          worker.terminate();
        }
      };
    } catch (err) {
      console.error('Failed to initialize web worker:', err);
      setError('Failed to initialize web worker. Falling back to main thread processing.');
      // Fallback to main thread
      setMoonData(getDefaultData());
      setIsLoading(false);
    }
  }, []);

  // Process data when it changes or filters change
  useEffect(() => {
    if (!moonData.length) return;
    
    // Process data asynchronously
    if (worker) {
      setIsLoading(true);
      worker.postMessage({
        action: 'process',
        data: moonData,
        filters
      });
    } else {
      // Fallback for when worker is not available
      // Import the mapReduce utils and process on main thread
      import('../utils/mapReduce').then(({ processMoonData, findSimultaneousAlignments }) => {
        setIsLoading(true);
        const startTime = performance.now();
        const processed = processMoonData(moonData, filters);
        const simultaneous = findSimultaneousAlignments(processed);
        const endTime = performance.now();
        
        setProcessedData(processed);
        setSimultaneousAlignments(simultaneous);
        setProcessingStats({
          processingTime: endTime - startTime,
          dataPoints: moonData.length,
          mappedDataPoints: moonData.length, // Approximation
          resultItems: processed.length
        });
        setIsLoading(false);
      }).catch(err => {
        setError('Failed to process data: ' + err.message);
        setIsLoading(false);
      });
    }
  }, [moonData, filters]);

  // Generate initial data
  const generateInitialData = useCallback(() => {
    try {
      if (worker) {
        setIsLoading(true);
        worker.postMessage({
          action: 'generate',
          filters: {
            startDate: filters.startDate,
            endDate: filters.endDate,
            interval: 3600000 // 1 hour
          }
        });
      } else {
        // Fallback
        setMoonData(getDefaultData());
        setIsLoading(false);
      }
    } catch (err) {
      setError('Failed to generate data: ' + err.message);
      setIsLoading(false);
    }
  }, [filters.startDate, filters.endDate]);

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Regenerate data for new date range
  const updateDateRange = useCallback((startDate, endDate) => {
    setFilters(prev => ({ ...prev, startDate, endDate }));
    
    // Generate new data if date range changes significantly
    try {
      if (worker) {
        setIsLoading(true);
        worker.postMessage({
          action: 'generate',
          filters: {
            startDate,
            endDate,
            interval: 3600000 // 1 hour
          }
        });
      } else {
        // Fallback
        setMoonData(generateMoonData(startDate, endDate));
        setIsLoading(false);
      }
    } catch (err) {
      setError('Failed to update date range: ' + err.message);
      setIsLoading(false);
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  // Mark notifications as read
  const markNotificationsAsRead = useCallback(() => {
    setHasNewNotifications(false);
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setHasNewNotifications(false);
  }, []);

  // Dismiss a single notification
  const dismissNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  }, []);

  // Export data as JSON
  const exportDataAsJson = useCallback(() => {
    try {
      const dataToExport = {
        processedData,
        simultaneousAlignments,
        metadata: {
          filters,
          generatedAt: new Date().toISOString(),
          stats: processingStats
        }
      };
      
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `moon-alignment-data-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export data: ' + err.message);
    }
  }, [processedData, simultaneousAlignments, filters, processingStats]);

  // Export data as CSV
  const exportDataAsCsv = useCallback(() => {
    try {
      // Create CSV content
      const headers = [
        'Location', 'Date', 'Average Visibility', 'Average Angle', 
        'Peak Visibility Time', 'Peak Visibility Value', 'Alignment Events'
      ].join(',');
      
      const rows = processedData.map(item => [
        item.locationName,
        format(new Date(item.date), 'yyyy-MM-dd'),
        item.avgVisibility.toFixed(2),
        item.avgAngle.toFixed(2),
        format(new Date(item.peakVisibilityTime), 'yyyy-MM-dd HH:mm'),
        item.peakVisibilityValue.toFixed(2),
        item.alignmentEvents.length
      ].join(','));
      
      const csvContent = [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `moon-alignment-data-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export data as CSV: ' + err.message);
    }
  }, [processedData]);

  // Context value
  const value = {
    moonData,
    processedData,
    simultaneousAlignments,
    isLoading,
    error,
    filters,
    processingStats,
    darkMode,
    notifications,
    hasNewNotifications,
    actions: {
      updateFilters,
      updateDateRange,
      toggleDarkMode,
      exportDataAsJson,
      exportDataAsCsv,
      generateInitialData,
      markNotificationsAsRead,
      clearNotifications,
      dismissNotification
    }
  };

  return (
    <MoonDataContext.Provider value={value}>
      {children}
    </MoonDataContext.Provider>
  );
};

// Custom hook for using the context
export const useMoonData = () => {
  const context = useContext(MoonDataContext);
  if (!context) {
    throw new Error('useMoonData must be used within a MoonDataProvider');
  }
  return context;
};

export default MoonDataContext; 