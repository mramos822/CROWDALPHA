// Plaid service for handling brokerage connections
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const plaidService = {
  async createLinkToken() {
    try {
      // Get auth token from localStorage
      const authToken = localStorage.getItem('auth_token');
      console.log('🔑 [PLAID] Auth token exists:', !!authToken);
      console.log('🔑 [PLAID] Auth token value:', authToken ? `${authToken.substring(0, 20)}...` : 'null');
      console.log('🔗 [PLAID] Calling endpoint:', `${API_BASE_URL}/api/auth/link-token`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('🔐 [PLAID] Adding Authorization header');
      } else {
        console.warn('⚠️ [PLAID] No auth token found - request will fail');
      }
      
      console.log('📤 [PLAID] Making POST request...');
      const response = await fetch(`${API_BASE_URL}/api/auth/link-token`, {
        method: 'POST',
        headers
      });
      
      console.log('📥 [PLAID] Response status:', response.status);
      console.log('📥 [PLAID] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ [PLAID] Error response:', error);
        throw new Error(error.detail || 'Failed to create link token');
      }

      const data = await response.json();
      console.log('✅ [PLAID] Success! Got link token:', data.link_token ? 'YES' : 'NO');
      return data;
    } catch (error) {
      console.error('❌ [PLAID] Error creating link token:', error);
      throw error;
    }
  },

  async exchangePublicToken(publicToken: string) {
    try {
      // Get auth token from localStorage
      const authToken = localStorage.getItem('auth_token');
      
      const response = await fetch(`${API_BASE_URL}/api/auth/connect-brokerage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({ public_token: publicToken })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to exchange public token');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error exchanging public token:', error);
      throw error;
    }
  }
};

