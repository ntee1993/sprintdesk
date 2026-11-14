const configured = import.meta.env.VITE_API_BASE_URL
if (import.meta.env.PROD && configured !== '/api')
  throw new Error('VITE_API_BASE_URL must be /api in production')
export const API_BASE_URL = (configured || 'http://localhost:3000').replace(/\/+$/, '')
