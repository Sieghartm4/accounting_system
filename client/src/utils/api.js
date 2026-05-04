// API utility with automatic 401/token expired handling

// Global fetch interceptor for auto-logout on token expiration
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  
  // Handle 401 responses globally
  if (response.status === 401) {
    // Clone response to read body without consuming original
    const clonedResponse = response.clone();
    try {
      const data = await clonedResponse.json();
      
      // If token expired, force logout
      if (data.code === 'TOKEN_EXPIRED' || data.message === 'Token expired') {
        console.log('Token expired, forcing logout');
        handleLogout();
        throw new Error('Session expired. Please login again.');
      }
    } catch (e) {
      // If JSON parsing fails or it's not a token expired error, 
      // still redirect to login on 401
      if (e.message !== 'Session expired. Please login again.') {
        handleLogout();
        throw new Error('Authentication failed. Please login again.');
      }
      throw e;
    }
  }
  
  return response;
};

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

  return response;
}

function handleLogout() {
  // Clear all auth data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Redirect to login page
  window.location.href = '/login';
}
