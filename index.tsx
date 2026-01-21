
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// SECURITY LAYER: Console Protection
// Only allows console usage if a specific developer secret is present in localStorage
const SECURE_DEV_TOKEN = 'mw_dev_access_777';
const hasDevAccess = localStorage.getItem('mw_dev_token') === SECURE_DEV_TOKEN;

if (!hasDevAccess && process.env.NODE_ENV === 'production') {
  const noop = () => {};
  const methods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'dir'];
  methods.forEach((method) => {
    (window.console as any)[method] = noop;
  });
  
  // Disable right-click to prevent "Inspect" for non-admins
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Anti-debugging loop
  setInterval(() => {
    (function() {
      (function a() {
        try {
          (function b(i) {
            if (('' + i / i).length !== 1 || i % 20 === 0) {
              (function() {}).constructor('debugger')();
            } else {
              debugger;
            }
            b(++i);
          })(0);
        } catch (e) {}
      })();
    })();
  }, 5000);
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
