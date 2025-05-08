import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Setup event listener for dark mode changes
const setupDarkModeListener = () => {
  // Add event listener for dark mode context changes
  document.addEventListener('darkModeChanged', (e) => {
    if (e.detail.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  });

  // Check system preference initially
  const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDarkMode) {
    document.body.classList.add('dark-mode');
  }

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const newDarkMode = e.matches;
    if (newDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    
    // Dispatch event for components to react to
    document.dispatchEvent(new CustomEvent('systemDarkModeChanged', {
      detail: { darkMode: newDarkMode }
    }));
  });
};

// Setup dark mode listener
setupDarkModeListener();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
