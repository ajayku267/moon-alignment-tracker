import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import { useMoonData } from '../../context/MoonDataContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MoonMap.css';

// Fix for marker icons in react-leaflet
// This is required due to how CRA handles static assets
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom moon icon
const moonIcon = (visibility) => {
  return new L.DivIcon({
    className: 'custom-moon-icon',
    html: `<div class="moon-marker" style="opacity: ${Math.max(0.4, visibility)};">
             <div class="moon-face" style="transform: rotate(${Math.random() * 360}deg);"></div>
           </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// Map recenter component
const MapUpdater = ({ processedData, zoomLevel }) => {
  const map = useMap();
  
  useEffect(() => {
    if (processedData && processedData.length > 0) {
      // Create bounds from all locations
      const bounds = L.latLngBounds([]);
      processedData.forEach(item => {
        bounds.extend([item.lat || 0, item.lng || 0]);
      });
      
      // Only fit bounds if valid
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
        if (zoomLevel) {
          map.setZoom(zoomLevel);
        }
      }
    }
  }, [map, processedData, zoomLevel]);
  
  return null;
};

// Heatmap component
const MoonHeatmap = ({ data, map }) => {
  useEffect(() => {
    if (!map || !data || data.length === 0) return;
    
    // Remove any existing heatmap layer
    map.eachLayer(layer => {
      if (layer.options && layer.options.id === 'heatmap') {
        map.removeLayer(layer);
      }
    });
    
    // Format data for heatmap
    const heatData = data.map(loc => {
      return [loc.lat, loc.lng, loc.avgVisibility * 2]; // Multiply by 2 to enhance visibility
    });
    
    // Create and add heatmap layer if Leaflet.heat is available
    if (window.L && window.L.heatLayer) {
      const heatLayer = window.L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: 10,
        max: 1.0,
        gradient: { 0.4: 'blue', 0.65: 'lime', 0.8: 'yellow', 1: 'red' },
        id: 'heatmap'
      });
      
      heatLayer.addTo(map);
    }
  }, [map, data]);
  
  return null;
};

const MoonMap = () => {
  const { 
    processedData, 
    simultaneousAlignments, 
    isLoading, 
    error, 
    darkMode
  } = useMoonData();
  
  const [mapRef, setMapRef] = useState(null);
  const [mapMode, setMapMode] = useState('default'); // 'default', 'heatmap', 'aligned'
  const [zoomLevel, setZoomLevel] = useState(null);

  // Group data by location
  const locationData = useMemo(() => {
    const data = {};
    
    // Process all data points and organize by location
    processedData.forEach(item => {
      if (!data[item.location]) {
        data[item.location] = {
          location: item.location,
          locationName: item.locationName,
          lat: item.lat,
          lng: item.lng,
          avgVisibility: 0,
          avgAngle: 0,
          dailyData: [],
          alignmentCount: 0
        };
      }
      
      // Add this data point
      data[item.location].dailyData.push(item);
      
      // Update average values
      const totalPoints = data[item.location].dailyData.length;
      data[item.location].avgVisibility = 
        (data[item.location].avgVisibility * (totalPoints - 1) + item.avgVisibility) / totalPoints;
      data[item.location].avgAngle = 
        (data[item.location].avgAngle * (totalPoints - 1) + item.avgAngle) / totalPoints;
      
      // Count alignments
      data[item.location].alignmentCount += item.alignmentEvents ? item.alignmentEvents.length : 0;
    });
    
    return Object.values(data);
  }, [processedData]);

  // Find multi-location alignments to highlight
  const alignmentLocations = useMemo(() => {
    const locations = new Set();
    simultaneousAlignments.forEach(alignment => {
      alignment.locations.forEach(loc => locations.add(loc));
    });
    return locations;
  }, [simultaneousAlignments]);
  
  // Handle map mode change
  const handleMapModeChange = (mode) => {
    setMapMode(mode);
    if (mode === 'aligned' && mapRef) {
      // Zoom to show only aligned locations
      const alignedLocationsData = locationData.filter(loc => 
        alignmentLocations.has(loc.location)
      );
      
      if (alignedLocationsData.length > 0) {
        const bounds = L.latLngBounds(
          alignedLocationsData.map(loc => [loc.lat, loc.lng])
        );
        mapRef.fitBounds(bounds, { padding: [50, 50] });
        setZoomLevel(mapRef.getZoom());
      }
    } else {
      setZoomLevel(null);
    }
  };

  if (error) {
    return <div className="map-error">Error loading map: {error}</div>;
  }

  if (isLoading) {
    return <div className="map-loading">Loading map data...</div>;
  }

  return (
    <div className={`moon-map-container ${darkMode ? 'dark-mode' : ''}`}>
      <div className="map-controls">
        <button 
          className={`map-mode-btn ${mapMode === 'default' ? 'active' : ''}`}
          onClick={() => handleMapModeChange('default')}
        >
          Standard View
        </button>
        <button 
          className={`map-mode-btn ${mapMode === 'heatmap' ? 'active' : ''}`}
          onClick={() => handleMapModeChange('heatmap')}
        >
          Visibility Heatmap
        </button>
        <button 
          className={`map-mode-btn ${mapMode === 'aligned' ? 'active' : ''}`}
          onClick={() => handleMapModeChange('aligned')}
          disabled={alignmentLocations.size === 0}
        >
          Show Aligned Only
        </button>
      </div>
      
      <MapContainer 
        center={[20, 0]} 
        zoom={2} 
        style={{ height: '100%', width: '100%' }}
        className={darkMode ? 'dark-map' : ''}
        whenCreated={setMapRef}
      >
        <TileLayer
          url={darkMode 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Render markers for each location */}
        {locationData.map(location => {
          // Skip locations that aren't aligned if in aligned mode
          if (mapMode === 'aligned' && !alignmentLocations.has(location.location)) {
            return null;
          }
          
          return (
            <React.Fragment key={location.location}>
              {/* Location marker */}
              <Marker 
                position={[location.lat, location.lng]} 
                icon={mapMode === 'default' ? markerIcon : moonIcon(location.avgVisibility)}
              >
                <Popup>
                  <div className="location-popup">
                    <h3>{location.locationName}</h3>
                    <p>Average Visibility: {location.avgVisibility.toFixed(2)}</p>
                    <p>Average Moon Angle: {location.avgAngle.toFixed(2)}°</p>
                    <p>Alignment Events: {location.alignmentCount}</p>
                  </div>
                </Popup>
              </Marker>
              
              {/* Visibility circle around location */}
              {mapMode === 'default' && (
                <Circle 
                  center={[location.lat, location.lng]}
                  radius={100000 + (location.avgVisibility * 500000)} 
                  pathOptions={{
                    fillColor: alignmentLocations.has(location.location) 
                      ? '#ffff00' 
                      : `hsl(240, 100%, ${(location.avgVisibility * 100).toFixed(0)}%)`,
                    fillOpacity: 0.5,
                    weight: alignmentLocations.has(location.location) ? 3 : 1,
                    color: alignmentLocations.has(location.location) ? '#ff9900' : '#3388ff'
                  }}
                >
                  <Popup>
                    <div className="location-popup">
                      <h3>{location.locationName}</h3>
                      <p>Moon Visibility: {location.avgVisibility.toFixed(2)}</p>
                      <p>Alignment Events: {location.alignmentCount}</p>
                      {alignmentLocations.has(location.location) && (
                        <p className="alignment-notice">
                          This location has alignments with other locations!
                        </p>
                      )}
                    </div>
                  </Popup>
                </Circle>
              )}
            </React.Fragment>
          );
        })}
        
        {/* Conditionally render heatmap */}
        {mapMode === 'heatmap' && mapRef && (
          <MoonHeatmap data={locationData} map={mapRef} />
        )}
        
        {/* Update map view based on data */}
        <MapUpdater processedData={locationData} zoomLevel={zoomLevel} />
      </MapContainer>
      
      <div className="map-legend">
        <h4>Map Legend</h4>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#3388ff'}}></span>
          <span>Normal Visibility</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#ffff00'}}></span>
          <span>Aligned Locations</span>
        </div>
        {mapMode === 'heatmap' && (
          <>
            <div className="legend-item">
              <span className="legend-color" style={{backgroundColor: 'blue'}}></span>
              <span>Low Visibility</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{backgroundColor: 'lime'}}></span>
              <span>Medium Visibility</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{backgroundColor: 'red'}}></span>
              <span>High Visibility</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MoonMap; 