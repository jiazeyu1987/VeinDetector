import React, { useState } from 'react';
import { MainLayout } from './components/MainLayout';
import { SimpleCanvasTest } from './components/SimpleCanvasTest';
import './App.css';

function App() {
  const [testMode, setTestMode] = useState(() => {
    return window.location.search.includes('test=true');
  });

  if (testMode) {
    return (
      <div className="App">
        <SimpleCanvasTest />
      </div>
    );
  }

  return (
    <div className="App">
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setTestMode(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-sm"
          title="进入灰度值测试模式"
        >
          灰度值测试
        </button>
      </div>
      <MainLayout />
    </div>
  );
}

export default App;