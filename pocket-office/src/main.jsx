import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { seedDatabase } from './db';
import './styles/global.css';

seedDatabase().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
});
