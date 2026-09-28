import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {initStorage} from './services/sqliteStore';

const root = createRoot(document.getElementById('root')!);

initStorage()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error) => {
    console.error('Storage initialization failed:', error);
    root.render(
      <div dir="rtl" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', background: '#f6f8fa', color: '#17212b' }}>
        <div style={{ maxWidth: 520, textAlign: 'center', background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 10px 35px rgba(0,0,0,.08)' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>تعذر تشغيل قاعدة البيانات</h1>
          <p style={{ margin: '0 0 16px', lineHeight: 1.8 }}>لم يتم تشغيل SQLite بأمان، لذلك تم إيقاف التطبيق لمنع حفظ بيانات جديدة في مخزن غير صحيح.</p>
          <p style={{ margin: 0, fontSize: 13, opacity: .7, direction: 'ltr', wordBreak: 'break-word' }}>{String(error?.message || error)}</p>
        </div>
      </div>,
    );
  });
