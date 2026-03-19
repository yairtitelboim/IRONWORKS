import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { PerplexityModalProvider } from './contexts/PerplexityModalContext';
import { AIInteractionProvider } from './contexts/AIInteractionContext';
import { SceneProvider } from './contexts/SceneContext';
import { LayerStateProvider } from './contexts/LayerStateContext';

// Import default scenes to ensure they load on app start
import './utils/defaultScenes';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <PerplexityModalProvider>
      <AIInteractionProvider>
        <SceneProvider>
          <LayerStateProvider>
            <App />
          </LayerStateProvider>
        </SceneProvider>
      </AIInteractionProvider>
    </PerplexityModalProvider>
  </React.StrictMode>
);