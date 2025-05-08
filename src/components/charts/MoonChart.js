import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { format } from 'date-fns';
import { useMoonData } from '../../context/MoonDataContext';
import './MoonChart.css';

// Register Chart.js components
Chart.register(...registerables);

const MoonChart = () => {
  const { processedData, isLoading, darkMode } = useMoonData();
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [error, setError] = useState(null);

  // Create or update chart
  useEffect(() => {
    if (isLoading || !processedData || processedData.length === 0 || !chartRef.current) {
      return;
    }
    
    try {
      // Destroy previous chart instance if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      // Simple color generator
      const colors = [
        '#4285F4', '#EA4335', '#FBBC05', '#34A853',
        '#FF6D00', '#2979FF', '#00BFA5', '#D500F9'
      ];
      
      // Process data into a simpler format
      // Group by location
      const locationData = {};
      const dateLabels = new Set();
      
      processedData.forEach(item => {
        if (!item || !item.location || !item.date) return;
        
        const dateStr = format(new Date(item.date), 'yyyy-MM-dd');
        dateLabels.add(dateStr);
        
        if (!locationData[item.location]) {
          locationData[item.location] = {
            name: item.locationName || item.location,
            visibility: {},
            alignmentCounts: {}
          };
        }
        
        // Store visibility data
        if (typeof item.avgVisibility === 'number') {
          locationData[item.location].visibility[dateStr] = item.avgVisibility;
        }
        
        // Store alignment counts
        if (item.alignmentEvents && Array.isArray(item.alignmentEvents)) {
          locationData[item.location].alignmentCounts[dateStr] = item.alignmentEvents.length;
        }
      });
      
      // Sort date labels
      const sortedDates = Array.from(dateLabels).sort();
      
      // Build datasets
      const datasets = [];
      let colorIndex = 0;
      
      Object.keys(locationData).forEach(locationId => {
        const locationInfo = locationData[locationId];
        const color = colors[colorIndex % colors.length];
        colorIndex++;
        
        // Visibility dataset
        const visibilityData = sortedDates.map(date => 
          locationInfo.visibility[date] !== undefined ? locationInfo.visibility[date] : null
        );
        
        datasets.push({
          label: `${locationInfo.name} Visibility`,
          data: visibilityData,
          borderColor: color,
          backgroundColor: color + '33', // Add transparency
          borderWidth: 2,
          tension: 0.3,
          fill: false
        });
      });
      
      // Create chart
      const ctx = chartRef.current.getContext('2d');
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: sortedDates,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: darkMode ? '#ddd' : '#333'
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false
            },
            title: {
              display: true,
              text: 'Moon Visibility by Location',
              color: darkMode ? '#fff' : '#333'
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Date',
                color: darkMode ? '#ddd' : '#666'
              },
              grid: {
                color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                color: darkMode ? '#bbb' : '#666'
              }
            },
            y: {
              min: 0,
              max: 1,
              title: {
                display: true,
                text: 'Visibility (0-1)',
                color: darkMode ? '#ddd' : '#666'
              },
              grid: {
                color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                color: darkMode ? '#bbb' : '#666'
              }
            }
          }
        }
      });
      
      setError(null);
    } catch (err) {
      console.error('Error creating chart:', err);
      setError(err.message);
    }
    
    // Cleanup
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [processedData, isLoading, darkMode]);

  if (isLoading) {
    return <div className="chart-loading">Loading chart data...</div>;
  }
  
  if (error) {
    return (
      <div className="chart-error">
        <p>Error loading chart: {error}</p>
        <p>Please try refreshing the page or check the console for more details.</p>
      </div>
    );
  }

  return (
    <div className={`moon-chart-container ${darkMode ? 'dark-mode' : ''}`}>
      <canvas ref={chartRef} />
      
      <div className="chart-instructions">
        <p>
          This chart shows moon visibility over time for each location.
          Toggle visibility by clicking on legend items.
        </p>
      </div>
    </div>
  );
};

export default MoonChart; 