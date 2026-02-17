import React, { useState, useEffect } from 'react';
import { api } from './api';
import './AdminPanel.css';

export default function AdminPanel({ user, onLogout, onEditMission, onNewMission }) {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadMissions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listMissions();
      setMissions(data.missions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, []);

  const handleLogout = async () => {
    try { await api.logout(); } catch (_) {}
    onLogout();
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete mission "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await api.deleteMission(id);
      setMissions((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert('Error deleting mission: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="admin-panel">
      {/* Header */}
      <header className="ap-header">
        <div className="ap-header-brand">
          <div className="ap-logo">M</div>
          <div>
            <div className="ap-brand-name">Mission Designer</div>
            <div className="ap-brand-sub">Admin Panel</div>
          </div>
        </div>
        <div className="ap-header-right">
          <span className="ap-user">
            Logged in as <strong>{user?.username}</strong>
          </span>
          <button className="ap-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="ap-main">
        <div className="ap-section-header">
          <div>
            <h2>Missions</h2>
            <p className="ap-section-hint">
              {missions.length} mission{missions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button className="ap-new-btn" onClick={onNewMission}>
            + New Mission
          </button>
        </div>

        {loading && (
          <div className="ap-state">
            <div className="ap-spinner" />
            <p>Loading missions...</p>
          </div>
        )}

        {!loading && error && (
          <div className="ap-error">
            <p>{error}</p>
            <button className="ap-retry-btn" onClick={loadMissions}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && missions.length === 0 && (
          <div className="ap-empty">
            <div className="ap-empty-icon">📋</div>
            <h3>No missions yet</h3>
            <p>Create your first mission to get started.</p>
            <button className="ap-new-btn" onClick={onNewMission}>
              + Create Mission
            </button>
          </div>
        )}

        {!loading && !error && missions.length > 0 && (
          <div className="ap-grid">
            {missions.map((mission) => (
              <div key={mission.id} className="ap-card">
                <div className="ap-card-body">
                  <h3 className="ap-card-title">{mission.title}</h3>
                  {mission.description && (
                    <p className="ap-card-desc">{mission.description}</p>
                  )}
                  <div className="ap-card-meta">
                    <span>Created {formatDate(mission.created_at)}</span>
                    <span>Updated {formatDate(mission.updated_at)}</span>
                  </div>
                </div>
                <div className="ap-card-footer">
                  <button
                    className="ap-edit-btn"
                    onClick={() => onEditMission(mission.id)}
                  >
                    ✎ Edit
                  </button>
                  <button
                    className="ap-delete-btn"
                    onClick={() => handleDelete(mission.id, mission.title)}
                    disabled={deletingId === mission.id}
                  >
                    {deletingId === mission.id ? 'Deleting...' : '✕ Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
