import React from 'react';
import { MoonDataProvider } from './context/MoonDataContext';
import FilterPanel from './components/filters/FilterPanel';
import MoonMap from './components/map/MoonMap';
import MoonChart from './components/charts/MoonChart';
import AlignmentTable from './components/AlignmentTable';
import RealTimeSimulation from './components/RealTimeSimulation';
import Notifications from './components/Notifications';
import './App.css';

function App() {
  return (
    <MoonDataProvider>
      <div className="App">
        <header className="App-header">
          <h1>Moon Alignment Tracker</h1>
          <p className="App-subtitle">
            Track and visualize moon alignment patterns across different locations
          </p>
        </header>
        
        <main className="App-main">
          <section className="App-section">
            <FilterPanel />
          </section>
          
          <section className="App-section">
            <h2 className="section-title">Moon Alignment Map</h2>
            <MoonMap />
          </section>
          
          <section className="App-section">
            <h2 className="section-title">Alignment Trends</h2>
            <MoonChart />
          </section>
          
          <section className="App-section">
            <AlignmentTable />
          </section>
          
          <section className="App-section">
            <RealTimeSimulation />
          </section>
        </main>
        
        <footer className="App-footer">
          <p>
            Moon Alignment Tracker - Built with React.js using MapReduce data processing
          </p>
        </footer>
        
        <Notifications />
      </div>
    </MoonDataProvider>
  );
}

export default App;
