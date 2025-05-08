// Moon data generator
// Format: [timestamp, location, moon_angle, visibility]

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

// Generate random moon position data for a date range
const generateMoonData = (startDate, endDate, interval = 3600000) => {
  const data = [];
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
        date: new Date(timestamp),
        location: location.id,
        locationName: location.name,
        lat: location.lat,
        lng: location.lng,
        moon_angle,
        visibility,
      });
    });
  }
  
  return data;
};

// Generate data for a default 7-day period
const getDefaultData = () => {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  
  return generateMoonData(startDate, endDate);
};

// Export the data and functions
export { LOCATIONS, generateMoonData, getDefaultData }; 