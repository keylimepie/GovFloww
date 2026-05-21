import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#155e75',
          colorInfo: '#2563eb',
          colorSuccess: '#15803d',
          colorWarning: '#b45309',
          colorError: '#b91c1c',
          borderRadius: 6,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        components: {
          Layout: {
            bodyBg: '#f6f8fb',
            siderBg: '#13233a',
            headerBg: '#ffffff',
          },
          Menu: {
            darkItemBg: '#13233a',
            darkSubMenuItemBg: '#13233a',
            darkItemSelectedBg: '#155e75',
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
