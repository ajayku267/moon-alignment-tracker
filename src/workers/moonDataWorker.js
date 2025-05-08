/**
 * Web Worker for processing moon data asynchronously
 */

// Import helper functions (these will be copied into the worker)
const mapMoonData = (data, filters = {}) => {
  const { startDate, endDate, location, angleThreshold, visibilityThreshold } = filters;
  
  // Convert dates to timestamps for comparison
  const startTimestamp = startDate ? new Date(startDate).getTime() : 0;
  const endTimestamp = endDate ? new Date(endDate).getTime() : Infinity;
  
  // Return filtered data as key-value pairs
  return data.filter(item => {
    // Filter by date range
    if (item.timestamp < startTimestamp || item.timestamp > endTimestamp) {
      return false;
    }
    
    // Filter by location if specified
    if (location && item.location !== location) {
      return false;
    }
    
    // Filter by moon angle threshold if specified
    if (angleThreshold !== undefined && item.moon_angle < angleThreshold) {
      return false;
    }
    
    // Filter by visibility threshold if specified
    if (visibilityThreshold !== undefined && item.visibility < visibilityThreshold) {
      return false;
    }
    
    return true;
  }).map(item => ({
    key: `${item.location}_${Math.floor(item.timestamp / 86400000)}`, // Group by location and day
    value: item
  }));
};

// Reducer function to aggregate data by location and find alignment events
const reduceMoonData = (mappedData) => {
  const result = {};
  
  // Group the mapped data by keys
  mappedData.forEach(({ key, value }) => {
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(value);
  });
  
  // Process each group to extract insights
  return Object.entries(result).map(([key, values]) => {
    // Sort by timestamp
    values.sort((a, b) => a.timestamp - b.timestamp);
    
    // Get average visibility and angle for the group
    const avgVisibility = values.reduce((sum, v) => sum + v.visibility, 0) / values.length;
    const avgAngle = values.reduce((sum, v) => sum + v.moon_angle, 0) / values.length;
    
    // Find peak visibility time
    const peakVisibility = values.reduce((max, v) => v.visibility > max.visibility ? v : max, { visibility: 0 });
    
    // Find alignment events (consecutive readings with high visibility)
    const alignmentEvents = [];
    let currentEvent = null;
    
    values.forEach(v => {
      if (v.visibility > 0.7) { // Threshold for alignment
        if (!currentEvent) {
          currentEvent = {
            start: v.timestamp,
            end: v.timestamp,
            location: v.location,
            locationName: v.locationName,
            data: [v]
          };
        } else {
          currentEvent.end = v.timestamp;
          currentEvent.data.push(v);
        }
      } else if (currentEvent) {
        // If the event lasted more than 2 hours, record it
        if (currentEvent.end - currentEvent.start >= 2 * 3600000) {
          alignmentEvents.push({
            ...currentEvent,
            duration: (currentEvent.end - currentEvent.start) / 3600000, // in hours
            avgVisibility: currentEvent.data.reduce((sum, d) => sum + d.visibility, 0) / currentEvent.data.length,
            avgAngle: currentEvent.data.reduce((sum, d) => sum + d.moon_angle, 0) / currentEvent.data.length
          });
        }
        currentEvent = null;
      }
    });
    
    // Include the current event if it exists and meets the criteria
    if (currentEvent && (currentEvent.end - currentEvent.start >= 2 * 3600000)) {
      alignmentEvents.push({
        ...currentEvent,
        duration: (currentEvent.end - currentEvent.start) / 3600000, // in hours
        avgVisibility: currentEvent.data.reduce((sum, d) => sum + d.visibility, 0) / currentEvent.data.length,
        avgAngle: currentEvent.data.reduce((sum, d) => sum + d.moon_angle, 0) / currentEvent.data.length
      });
    }
    
    // Return processed data for this key (location and day)
    return {
      key,
      location: values[0].location,
      locationName: values[0].locationName,
      date: new Date(Math.floor(values[0].timestamp / 86400000) * 86400000),
      dataPoints: values.length,
      avgVisibility,
      avgAngle,
      peakVisibilityTime: new Date(peakVisibility.timestamp),
      peakVisibilityValue: peakVisibility.visibility,
      alignmentEvents
    };
  });
};

// Find locations with simultaneous moon alignments
const findSimultaneousAlignments = (processedData, thresholdHours = 3) => {
  // Group alignments by timestamp buckets (e.g., 3-hour intervals)
  const timeGroups = {};
  
  processedData.forEach(locationData => {
    if (!locationData.alignmentEvents) return;
    
    locationData.alignmentEvents.forEach(event => {
      // Group by 3-hour time buckets
      const timeKey = Math.floor(event.start / (thresholdHours * 3600000));
      
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = [];
      }
      
      timeGroups[timeKey].push({
        location: locationData.location,
        locationName: locationData.locationName,
        start: event.start,
        end: event.end,
        duration: event.duration,
        avgVisibility: event.avgVisibility,
        avgAngle: event.avgAngle
      });
    });
  });
  
  // Filter for time buckets with multiple locations
  return Object.entries(timeGroups)
    .filter(([_, alignments]) => alignments.length > 1)
    .map(([timeKey, alignments]) => ({
      timeKey: parseInt(timeKey),
      timestamp: parseInt(timeKey) * thresholdHours * 3600000,
      date: new Date(parseInt(timeKey) * thresholdHours * 3600000),
      locations: alignments.map(a => a.location),
      locationNames: alignments.map(a => a.locationName),
      alignmentData: alignments
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

// Worker message handler
self.onmessage = function(e) {
  const { action, data, filters } = e.data;
  
  switch (action) {
    case 'process': {
      // Apply MapReduce processing
      const startTime = performance.now();
      const mappedData = mapMoonData(data, filters);
      const reducedData = reduceMoonData(mappedData);
      const simultaneous = findSimultaneousAlignments(reducedData);
      const endTime = performance.now();
      
      // Send processed data back to main thread
      self.postMessage({
        type: 'result',
        processedData: reducedData,
        simultaneousAlignments: simultaneous,
        processingTime: endTime - startTime,
        dataPoints: data.length,
        mappedDataPoints: mappedData.length,
        resultItems: reducedData.length
      });
      break;
    }
    
    case 'generate': {
      // Generate data for the given parameters
      const { startDate, endDate, interval } = filters;
      const data = [];
      const LOCATIONS = [
        { id: 'NYC', name: 'New York', lat: 40.7128, lng: -74.0060 },
        { id: 'LON', name: 'London', lat: 51.5074, lng: -0.1278 },
        { id: 'TKY', name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
        { id: 'SYD', name: 'Sydney', lat: -33.8688, lng: 151.2093 },
        { id: 'RIO', name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
        { id: 'CAI', name: 'Cairo', lat: 30.0444, lng: 31.2357 },
        { id: 'CPT', name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
        { id: 'MEX', name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
      ];
      
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      
      for (let timestamp = start; timestamp <= end; timestamp += interval) {
        LOCATIONS.forEach(location => {
          // Generate random angle (0-360 degrees)
          const baseAngle = (timestamp / 86400000) * 12; // Full cycle every 30 days
          const angleOffset = Math.sin(timestamp / 1000000) * 15; // Add some variation
          const moon_angle = (baseAngle + angleOffset + location.lat / 10) % 360;
          
          // Generate visibility (0-1)
          const moonPhase = Math.sin((timestamp / 2551443000) * Math.PI * 2); // Lunar cycle ~29.5 days
          const timeOfDay = Math.sin((timestamp % 86400000) / 86400000 * Math.PI * 2);
          const visibility = Math.max(0, Math.min(1, 
            0.5 + 0.5 * moonPhase - 0.3 * Math.max(0, timeOfDay)
          ));
          
          data.push({
            timestamp,
            date: new Date(timestamp).toISOString(),
            location: location.id,
            locationName: location.name,
            lat: location.lat,
            lng: location.lng,
            moon_angle,
            visibility,
          });
        });
      }
      
      self.postMessage({
        type: 'generated',
        data,
        dataPoints: data.length
      });
      break;
    }
    
    default:
      self.postMessage({
        type: 'error',
        message: `Unknown action: ${action}`
      });
  }
}; 