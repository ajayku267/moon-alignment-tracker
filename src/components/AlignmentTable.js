import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { useMoonData } from '../context/MoonDataContext';
import './AlignmentTable.css';

// Helper function to predict future alignments
const predictFutureAlignments = (alignmentData, daysToPredict = 30) => {
  if (!alignmentData || alignmentData.length < 2) return [];
  
  // Calculate average time between alignments per location
  const locationPatterns = {};
  
  alignmentData.forEach(alignment => {
    alignment.alignmentData.forEach(locData => {
      if (!locationPatterns[locData.location]) {
        locationPatterns[locData.location] = {
          location: locData.location,
          locationName: locData.locationName,
          timestamps: [],
          intervals: []
        };
      }
      
      locationPatterns[locData.location].timestamps.push(locData.start);
    });
  });
  
  // Calculate intervals for each location
  Object.values(locationPatterns).forEach(pattern => {
    if (pattern.timestamps.length >= 2) {
      pattern.timestamps.sort((a, b) => a - b);
      
      for (let i = 1; i < pattern.timestamps.length; i++) {
        const interval = pattern.timestamps[i] - pattern.timestamps[i-1];
        pattern.intervals.push(interval);
      }
    }
  });
  
  // Calculate average interval for each location with sufficient data
  const predictions = [];
  const today = new Date().getTime();
  
  Object.values(locationPatterns).forEach(pattern => {
    if (pattern.intervals.length > 0) {
      // Calculate average interval
      const avgInterval = pattern.intervals.reduce((sum, interval) => sum + interval, 0) / 
                          pattern.intervals.length;
      
      // Get last known alignment
      const lastAlignment = pattern.timestamps[pattern.timestamps.length - 1];
      
      // Predict next alignments
      let nextPrediction = lastAlignment + avgInterval;
      const endPredictionTime = today + (daysToPredict * 86400000); // daysToPredict in ms
      
      while (nextPrediction <= endPredictionTime) {
        if (nextPrediction > today) {
          predictions.push({
            location: pattern.location,
            locationName: pattern.locationName,
            timestamp: nextPrediction,
            confidence: Math.min(0.9, 0.4 + (0.1 * pattern.intervals.length)) // More data = higher confidence
          });
        }
        nextPrediction += avgInterval;
      }
    }
  });
  
  // Sort by timestamp
  return predictions.sort((a, b) => a.timestamp - b.timestamp);
};

// Find potential multi-location alignments in predictions
const findPotentialSimultaneousAlignments = (predictions, hourThreshold = 6) => {
  const timeGroups = {};
  const msThreshold = hourThreshold * 3600000;
  
  // Group predictions by time
  predictions.forEach(pred => {
    const timeKey = Math.floor(pred.timestamp / msThreshold);
    
    if (!timeGroups[timeKey]) {
      timeGroups[timeKey] = [];
    }
    
    timeGroups[timeKey].push(pred);
  });
  
  // Filter for time groups with multiple locations
  return Object.entries(timeGroups)
    .filter(([_, preds]) => preds.length > 1)
    .map(([timeKey, preds]) => ({
      timeKey: parseInt(timeKey),
      timestamp: parseInt(timeKey) * msThreshold,
      date: new Date(parseInt(timeKey) * msThreshold),
      locations: preds.map(p => p.location),
      locationNames: preds.map(p => p.locationName),
      predictions: preds,
      averageConfidence: preds.reduce((sum, p) => sum + p.confidence, 0) / preds.length
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const AlignmentTable = () => {
  const { 
    simultaneousAlignments, 
    processedData, 
    isLoading, 
    darkMode 
  } = useMoonData();
  
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [daysToPredict, setDaysToPredict] = useState(30);
  
  // Generate predictions
  const predictions = useMemo(() => {
    return predictFutureAlignments(simultaneousAlignments, daysToPredict);
  }, [simultaneousAlignments, daysToPredict]);
  
  // Find potential simultaneous alignments
  const potentialSimultaneous = useMemo(() => {
    return findPotentialSimultaneousAlignments(predictions);
  }, [predictions]);

  if (isLoading) {
    return <div className="alignment-loading">Loading alignment data...</div>;
  }

  // Count total alignment events
  const totalAlignments = processedData.reduce((count, item) => {
    return count + (item.alignmentEvents ? item.alignmentEvents.length : 0);
  }, 0);

  return (
    <div className={`alignment-table-container ${darkMode ? 'dark-mode' : ''}`}>
      <h2>Moon Alignment Events</h2>
      
      <div className="alignment-summary">
        <div className="summary-item">
          <span className="summary-label">Total Alignment Events:</span>
          <span className="summary-value">{totalAlignments}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Multi-Location Alignments:</span>
          <span className="summary-value">{simultaneousAlignments.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Upcoming Predictions:</span>
          <span className="summary-value">{predictions.length}</span>
        </div>
      </div>
      
      <div className="analysis-toggle">
        <button 
          className={`analysis-button ${showAnalysis ? 'active' : ''}`}
          onClick={() => setShowAnalysis(!showAnalysis)}
        >
          {showAnalysis ? 'Hide Analysis' : 'Show Advanced Analysis'}
        </button>
      </div>
      
      {showAnalysis && (
        <div className="advanced-analysis">
          <h3>Advanced Alignment Analysis & Predictions</h3>
          
          <div className="prediction-controls">
            <label htmlFor="days-input">Days to predict:</label>
            <input 
              id="days-input"
              type="range" 
              min="7" 
              max="90" 
              value={daysToPredict} 
              onChange={(e) => setDaysToPredict(parseInt(e.target.value))}
            />
            <span>{daysToPredict} days</span>
          </div>
          
          {potentialSimultaneous.length > 0 ? (
            <div className="potential-alignments">
              <h4>Potential Multi-Location Alignments</h4>
              <p className="prediction-note">
                Based on historical patterns, these locations may experience simultaneous alignments:
              </p>
              
              <table className="alignment-table">
                <thead>
                  <tr>
                    <th>Predicted Date</th>
                    <th>Locations</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {potentialSimultaneous.map((alignment, index) => (
                    <tr key={index}>
                      <td>{format(new Date(alignment.timestamp), 'MMM dd, yyyy')}</td>
                      <td>
                        <div className="location-list">
                          {alignment.locationNames.map((name, i) => (
                            <span key={i} className="location-tag">{name}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="confidence-meter">
                          <div 
                            className="confidence-fill" 
                            style={{width: `${alignment.averageConfidence * 100}%`}}
                          ></div>
                          <span>{Math.round(alignment.averageConfidence * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-predictions">
              Not enough data to make multi-location alignment predictions.
              Add more historical data to improve prediction capabilities.
            </p>
          )}
          
          <div className="individual-predictions">
            <h4>Individual Location Predictions</h4>
            <div className="prediction-grid">
              {predictions.length > 0 ? predictions
                .reduce((locations, pred) => {
                  const existing = locations.find(loc => loc.location === pred.location);
                  if (existing) {
                    existing.predictions.push(pred);
                  } else {
                    locations.push({
                      location: pred.location,
                      locationName: pred.locationName,
                      predictions: [pred]
                    });
                  }
                  return locations;
                }, [])
                .map(location => (
                  <div key={location.location} className="prediction-card">
                    <h5>{location.locationName}</h5>
                    <div className="prediction-dates">
                      {location.predictions
                        .slice(0, 3) // Show only the first 3 predictions
                        .map((pred, i) => (
                          <div key={i} className="prediction-date">
                            <span className="date-label">
                              {format(new Date(pred.timestamp), 'MMM dd')}:
                            </span>
                            <span className="confidence-value">
                              {Math.round(pred.confidence * 100)}% confidence
                            </span>
                          </div>
                        ))}
                      {location.predictions.length > 3 && (
                        <div className="more-predictions">
                          +{location.predictions.length - 3} more predictions
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <p className="no-predictions">
                    Not enough data to make location-specific predictions.
                  </p>
                )
              }
            </div>
          </div>
        </div>
      )}
      
      {simultaneousAlignments.length > 0 ? (
        <div className="simultaneous-alignments">
          <h3>Simultaneous Alignments</h3>
          <table className="alignment-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Locations</th>
                <th>Avg. Visibility</th>
                <th>Duration (hrs)</th>
              </tr>
            </thead>
            <tbody>
              {simultaneousAlignments.map((alignment, index) => {
                // Calculate average visibility across locations
                const avgVisibility = alignment.alignmentData.reduce(
                  (sum, loc) => sum + loc.avgVisibility, 
                  0
                ) / alignment.alignmentData.length;
                
                // Calculate average duration
                const avgDuration = alignment.alignmentData.reduce(
                  (sum, loc) => sum + loc.duration, 
                  0
                ) / alignment.alignmentData.length;
                
                return (
                  <tr key={index}>
                    <td>{format(new Date(alignment.timestamp), 'MMM dd, yyyy HH:mm')}</td>
                    <td>
                      <div className="location-list">
                        {alignment.locationNames.map((name, i) => (
                          <span key={i} className="location-tag">{name}</span>
                        ))}
                      </div>
                    </td>
                    <td>{avgVisibility.toFixed(2)}</td>
                    <td>{avgDuration.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-alignments">
          No simultaneous alignments found in the selected time period.
          Try extending the date range or adjusting filters.
        </div>
      )}
      
      <div className="location-alignment-summary">
        <h3>Alignment Events by Location</h3>
        {processedData.length > 0 ? (
          <div className="location-grid">
            {processedData
              .reduce((locations, item) => {
                const existing = locations.find(loc => loc.location === item.location);
                if (existing) {
                  existing.alignmentCount += item.alignmentEvents.length;
                  existing.data.push(item);
                } else {
                  locations.push({
                    location: item.location,
                    locationName: item.locationName,
                    alignmentCount: item.alignmentEvents.length,
                    data: [item]
                  });
                }
                return locations;
              }, [])
              .sort((a, b) => b.alignmentCount - a.alignmentCount)
              .map(location => (
                <div key={location.location} className="location-card">
                  <h4>{location.locationName}</h4>
                  <div className="location-stats">
                    <div className="stat-item">
                      <span className="stat-label">Alignments:</span>
                      <span className="stat-value">{location.alignmentCount}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Days with Data:</span>
                      <span className="stat-value">{location.data.length}</span>
                    </div>
                  </div>
                  {location.alignmentCount > 0 && (
                    <div className="peak-alignment">
                      <span className="peak-label">Best visibility:</span>
                      <span className="peak-value">
                        {format(
                          new Date(location.data
                            .flatMap(item => item.alignmentEvents)
                            .sort((a, b) => b.avgVisibility - a.avgVisibility)[0]?.start || Date.now()),
                          'MMM dd'
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        ) : (
          <div className="no-alignments">
            No alignment data found for the selected filters.
          </div>
        )}
      </div>
    </div>
  );
};

export default AlignmentTable; 