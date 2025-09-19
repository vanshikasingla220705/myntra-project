import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { SearchProvider } from './context/SearchContext.jsx';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SearchProvider>
        <DndProvider backend={HTML5Backend}>
          <App />
        </DndProvider>
      </SearchProvider>
    </BrowserRouter>
  </React.StrictMode>
);