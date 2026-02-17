const API_BASE = '/api';

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

  // Uploads
  uploadImage: (file) => uploadFile('/upload/image.php', file),
  uploadAudio: (file) => uploadFile('/upload/audio.php', file),
};
