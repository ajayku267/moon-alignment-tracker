import React, { useState } from 'react';
import { format } from 'date-fns';
import { useMoonData } from '../../context/MoonDataContext';
import { LOCATIONS } from '../../data/moonData';
import './FilterPanel.css';

const FilterPanel = () => {
  const { 
    filters, 
    actions, 
    isLoading, 
    darkMode, 
    processingStats 
  } = useMoonData();
  
  const [localFilters, setLocalFilters] = useState({
    startDate: filters.startDate,
    endDate: filters.endDate,
    location: filters.location,
    angleThreshold: filters.angleThreshold,
    visibilityThreshold: filters.visibilityThreshold
  });

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    // Convert values for number inputs
    const processedValue = type === 'number' 
      ? (value === '' ? null : parseFloat(value))
      : value;
    
    setLocalFilters(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  // Handle date changes
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setLocalFilters(prev => ({
      ...prev,
      [name]: value ? new Date(value) : null
    }));
  };

  // Apply filters
  const handleApplyFilters = (e) => {
    e.preventDefault();
    
    // Apply filters without regenerating data
    actions.updateFilters({
      location: localFilters.location === '' ? null : localFilters.location,
      angleThreshold: localFilters.angleThreshold,
      visibilityThreshold: localFilters.visibilityThreshold
    });
    
    // Only update date range if dates have changed
    const startChanged = format(localFilters.startDate, 'yyyy-MM-dd') !== 
                          format(filters.startDate, 'yyyy-MM-dd');
    const endChanged = format(localFilters.endDate, 'yyyy-MM-dd') !== 
                        format(filters.endDate, 'yyyy-MM-dd');
    
    if (startChanged || endChanged) {
      actions.updateDateRange(localFilters.startDate, localFilters.endDate);
    }
  };
  
  // Toggle dark mode
  const handleToggleDarkMode = () => {
    actions.toggleDarkMode();
  };
  
  // Export data
  const handleExportData = (format) => {
    if (format === 'json') {
      actions.exportDataAsJson();
    } else if (format === 'csv') {
      actions.exportDataAsCsv();
    }
  };

  return (
    <div className={`filter-panel ${darkMode ? 'dark-mode' : ''}`}>
      <form onSubmit={handleApplyFilters}>
        <div className="filter-section">
          <h3>Date Range</h3>
          <div className="filter-row">
            <div className="filter-field">
              <label htmlFor="startDate">Start Date:</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={format(localFilters.startDate, 'yyyy-MM-dd')}
                onChange={handleDateChange}
                disabled={isLoading}
              />
            </div>
            
            <div className="filter-field">
              <label htmlFor="endDate">End Date:</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={format(localFilters.endDate, 'yyyy-MM-dd')}
                onChange={handleDateChange}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
        
        <div className="filter-section">
          <h3>Data Filters</h3>
          <div className="filter-row">
            <div className="filter-field">
              <label htmlFor="location">Location:</label>
              <select
                id="location"
                name="location"
                value={localFilters.location || ''}
                onChange={handleInputChange}
                disabled={isLoading}
              >
                <option value="">All Locations</option>
                {LOCATIONS.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-field">
              <label htmlFor="angleThreshold">Min Angle (°):</label>
              <input
                type="number"
                id="angleThreshold"
                name="angleThreshold"
                min="0"
                max="360"
                step="5"
                value={localFilters.angleThreshold || ''}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="No min"
              />
            </div>
            
            <div className="filter-field">
              <label htmlFor="visibilityThreshold">Min Visibility:</label>
              <input
                type="number"
                id="visibilityThreshold"
                name="visibilityThreshold"
                min="0"
                max="1"
                step="0.1"
                value={localFilters.visibilityThreshold || ''}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="No min"
              />
            </div>
          </div>
        </div>
        
        <div className="filter-actions">
          <button 
            type="submit" 
            className="apply-button"
            disabled={isLoading}
          >
            Apply Filters
          </button>
          
          <div className="actions-group">
            <button 
              type="button" 
              className="dark-mode-toggle"
              onClick={handleToggleDarkMode}
            >
              {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
            
            <div className="export-buttons">
              <button 
                type="button" 
                className="export-button"
                onClick={() => handleExportData('json')}
                disabled={isLoading}
              >
                Export as JSON
              </button>
              
              <button 
                type="button" 
                className="export-button"
                onClick={() => handleExportData('csv')}
                disabled={isLoading}
              >
                Export as CSV
              </button>
            </div>
          </div>
        </div>
      </form>
      
      {processingStats.processingTime > 0 && (
        <div className="processing-stats">
          <p>
            Processed {processingStats.dataPoints} data points in {processingStats.processingTime.toFixed(2)}ms.
            Found {processingStats.resultItems} results.
          </p>
        </div>
      )}
    </div>
  );
};

export default FilterPanel; 