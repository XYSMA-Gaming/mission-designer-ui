// VITE_API_BASE lets each deployment target point to the correct backend.
// Defaults to '/api' so local dev and the production deployment work with
// no extra configuration.
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const getToken = () => localStorage.getItem('token');

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

async function uploadFile(path, file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }

  return data;
}

export const api = {
  // Auth
  login: (username, password) =>
    request('/auth/login.php', { method: 'POST', body: JSON.stringify({ username, password }) }),

  register: (username, email, password) =>
    request('/auth/register.php', { method: 'POST', body: JSON.stringify({ username, email, password }) }),

  logout: () =>
    request('/auth/logout.php', { method: 'POST' }),

  // Missions
  listMissions: () => request('/missions/list.php'),

  getMission: (id) => request(`/missions/get.php?id=${id}`),

  saveMission: (data) =>
    request('/missions/save.php', { method: 'POST', body: JSON.stringify(data) }),

  deleteMission: (id) =>
    request(`/missions/delete.php?id=${id}`, { method: 'DELETE' }),

  downloadMission: async (id, title) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/missions/download.php?id=${id}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      let msg = `Download failed (${res.status})`;
      try { const d = await res.json(); msg = d.error || msg; } catch (_) {}
      throw new Error(msg);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (title || `mission_${id}`).replace(/[^a-z0-9_\- ]/gi, '_') + '.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Uploads
  uploadImage: (file) => uploadFile('/upload/image.php', file),
  uploadAudio: (file) => uploadFile('/upload/audio.php', file),
};
