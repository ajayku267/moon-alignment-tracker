import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { LOCATIONS } from '../data/moonData';
import { useMoonData } from '../context/MoonDataContext';
import './RealTimeSimulation.css';

const RealTimeSimulation = () => {
  const { darkMode } = useMoonData();
  const [isRunning, setIsRunning] = useState(false);
  const [simulationTime, setSimulationTime] = useState(new Date());
  const [simulationSpeed, setSimulationSpeed] = useState(10); // 10 minutes per second
  const [locations, setLocations] = useState(
    LOCATIONS.map(loc => ({
      ...loc,
      visibility: 0,
      angle: 0,
      aligned: false
    }))
  );
  
  // Animation frame reference
  const animationRef = useRef(null);
  // Last update timestamp
  const lastUpdateRef = useRef(Date.now());
  
  // Start/stop simulation
  const toggleSimulation = () => {
    if (isRunning) {
      // Stop simulation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    } else {
      // Start simulation
      lastUpdateRef.current = Date.now();
      animationRef.current = requestAnimationFrame(updateSimulation);
    }
    setIsRunning(!isRunning);
  };
  
  // Update simulation frame
  const updateSimulation = () => {
    const now = Date.now();
    const deltaTime = now - lastUpdateRef.current;
    lastUpdateRef.current = now;
    
    // Update simulation time (1 second real time = simulationSpeed minutes in simulation)
    const deltaSimTime = deltaTime * simulationSpeed * 60 * 1000 / 1000;
    setSimulationTime(prevTime => new Date(prevTime.getTime() + deltaSimTime));
    
    // Update each location's moon data
    setLocations(prevLocations => prevLocations.map(loc => {
      // Calculate updated moon angle and visibility based on simulation time
      const timestamp = simulationTime.getTime();
      
      // Generate moon angle (0-360 degrees)
      const baseAngle = (timestamp / 86400000) * 12; // Full cycle every 30 days
      const angleOffset = Math.sin(timestamp / 1000000) * 15; // Add some variation
      const angle = (baseAngle + angleOffset + loc.lat / 10) % 360;
      
      // Generate visibility (0-1)
      const moonPhase = Math.sin((timestamp / 2551443000) * Math.PI * 2); // Lunar cycle ~29.5 days
      const timeOfDay = Math.sin((timestamp % 86400000) / 86400000 * Math.PI * 2);
      const visibility = Math.max(0, Math.min(1, 
        0.5 + 0.5 * moonPhase - 0.3 * Math.max(0, timeOfDay)
      ));
      
      // Check if aligned (high visibility)
      const aligned = visibility > 0.7;
      
      return {
        ...loc,
        angle,
        visibility,
        aligned
      };
    }));
    
    // Continue animation loop
    animationRef.current = requestAnimationFrame(updateSimulation);
  };
  
  // Update simulation speed
  const handleSpeedChange = (e) => {
    setSimulationSpeed(parseInt(e.target.value, 10));
  };
  
  // Reset simulation
  const resetSimulation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsRunning(false);
    setSimulationTime(new Date());
    setLocations(LOCATIONS.map(loc => ({
      ...loc,
      visibility: 0,
      angle: 0,
      aligned: false
    })));
  };
  
  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  // Calculate how many locations are currently aligned
  const alignedCount = locations.filter(loc => loc.aligned).length;
  const hasMultipleAlignments = alignedCount >= 2;

  return (
    <div className={`simulation-container ${darkMode ? 'dark-mode' : ''}`}>
      <h2>Real-Time Moon Alignment Simulation</h2>
      
      <div className="simulation-controls">
        <div className="control-row">
          <button 
            className={`simulation-button ${isRunning ? 'stop-button' : 'start-button'}`}
            onClick={toggleSimulation}
          >
            {isRunning ? 'Pause Simulation' : 'Start Simulation'}
          </button>
          
          <button 
            className="simulation-button reset-button"
            onClick={resetSimulation}
            disabled={isRunning}
          >
            Reset
          </button>
        </div>
        
        <div className="control-row">
          <label htmlFor="speed-control">
            Simulation Speed: {simulationSpeed} min/sec
          </label>
          <input
            id="speed-control"
            type="range"
            min="1"
            max="60"
            step="1"
            value={simulationSpeed}
            onChange={handleSpeedChange}
            className="speed-slider"
          />
        </div>
      </div>
      
      <div className="simulation-time">
        <div className="time-display">
          <span className="time-label">Simulation Time:</span>
          <span className="time-value">{format(simulationTime, 'MMM dd, yyyy HH:mm')}</span>
        </div>
        
        <div className={`alignment-status ${hasMultipleAlignments ? 'multiple-alignments' : ''}`}>
          {alignedCount === 0 ? 'No alignments detected' : 
            alignedCount === 1 ? '1 location aligned' : 
            `${alignedCount} locations aligned simultaneously!`}
        </div>
      </div>
      
      <div className="moon-locations-grid">
        {locations.map(loc => (
          <div 
            key={loc.id} 
            className={`location-item ${loc.aligned ? 'aligned' : ''}`}
          >
            <h3>{loc.name}</h3>
            
            <div className="moon-indicator">
              <div 
                className="moon" 
                style={{
                  transform: `rotate(${loc.angle}deg)`,
                  opacity: 0.3 + loc.visibility * 0.7
                }}
              >
                <div className="moon-face"></div>
              </div>
            </div>
            
            <div className="location-data">
              <div className="data-row">
                <span className="data-label">Visibility:</span>
                <div className="visibility-bar">
                  <div 
                    className="visibility-fill" 
                    style={{width: `${loc.visibility * 100}%`}}
                  ></div>
                </div>
                <span className="data-value">{loc.visibility.toFixed(2)}</span>
              </div>
              
              <div className="data-row">
                <span className="data-label">Angle:</span>
                <span className="data-value">{Math.round(loc.angle)}°</span>
              </div>
              
              <div className="alignment-indicator">
                {loc.aligned ? 'Moon Aligned!' : 'Not Aligned'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RealTimeSimulation; 