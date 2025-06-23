// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Simple fetch wrapper
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Add auth token if it exists
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// API endpoints
export const api = {
  // Events
  events: {
    create: (data: any) => apiCall('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    list: () => apiCall('/api/events'),
    getById: (id: string) => apiCall(`/api/events/${id}`),
  },

  // Authentication
  auth: {
    register: (data: any) => apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    login: (data: any) => apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    profile: () => apiCall('/api/auth/profile'),
  },

  // Tickets
  tickets: {
    purchase: (data: any) => apiCall('/api/tickets/purchase', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    myTickets: () => apiCall('/api/tickets/my-tickets'),
    validate: (ticketId: string) => apiCall(`/api/tickets/${ticketId}/validate`, {
      method: 'POST',
    }),
  },

  // Payments
  payments: {
    createIntent: (data: any) => apiCall('/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    process: (data: any) => apiCall('/api/payments/process', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  // Test connection
  health: () => apiCall('/api/health'),
};
