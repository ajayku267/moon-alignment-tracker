/**
 * MapReduce implementation for processing moon alignment data
 */

// Map function to extract relevant moon data by date and location
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
    
    // Include the current event if it exists and meets the duration criteria
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

// Main MapReduce function
const processMoonData = (data, filters = {}) => {
  const mappedData = mapMoonData(data, filters);
  return reduceMoonData(mappedData);
};

// Find locations with simultaneous moon alignments
const findSimultaneousAlignments = (processedData, thresholdHours = 3) => {
  // Group alignments by timestamp buckets (e.g., 3-hour intervals)
  const timeGroups = {};
  
  processedData.forEach(locationData => {
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

export { mapMoonData, reduceMoonData, processMoonData, findSimultaneousAlignments }; 