import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './demo.css';
import DemoApp from './DemoApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>
);
