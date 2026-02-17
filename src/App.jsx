import React, { useState, useEffect } from 'react';
import LoginPage from './LoginPage';
import AdminPanel from './AdminPanel';
import MissionDesigner from './MissionDesigner';

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('login'); // 'login' | 'admin' | 'designer'
  const [editingMissionId, setEditingMissionId] = useState(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setPage('admin');
      } catch (_) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setPage('admin');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setEditingMissionId(null);
    setPage('login');
  };

  const handleEditMission = (missionId) => {
    setEditingMissionId(missionId);
    setPage('designer');
  };

  const handleNewMission = () => {
    setEditingMissionId(null);
    setPage('designer');
  };

  const handleBackToAdmin = () => {
    setEditingMissionId(null);
    setPage('admin');
  };

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (page === 'designer') {
    return <MissionDesigner missionId={editingMissionId} onBack={handleBackToAdmin} />;
  }

  return (
    <AdminPanel
      user={user}
      onLogout={handleLogout}
      onEditMission={handleEditMission}
      onNewMission={handleNewMission}
    />
  );
}
