// API utility with automatic 401/token expired handling

export async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 responses
  if (response.status === 401) {
    try {
      const data = await response.json();
      
      // If token expired, force logout
      if (data.code === 'TOKEN_EXPIRED' || data.message === 'Token expired') {
        console.log('Token expired, forcing logout');
        handleLogout();
        throw new Error('Session expired. Please login again.');
      }
    } catch (e) {
      // If JSON parsing fails, still handle 401
      handleLogout();
      throw new Error('Authentication failed. Please login again.');
    }
  }

  return response;
}

function handleLogout() {
  // Clear all auth data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Redirect to login page
  window.location.href = '/login';
}
