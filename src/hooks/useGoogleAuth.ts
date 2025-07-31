import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  userInfo: {
    email?: string;
    name?: string;
  } | null;
}

export function useGoogleAuth() {
  const [authState, setAuthState] = useState<GoogleAuthState>({
    isAuthenticated: false,
    accessToken: null,
    userInfo: null,
  });

  const GOOGLE_CLIENT_ID = ''; // This would need to be set by the user
  const SCOPE = 'https://www.googleapis.com/auth/contacts.readonly';

  useEffect(() => {
    // Check if user is already authenticated (token in localStorage)
    const storedToken = localStorage.getItem('google_access_token');
    const storedUserInfo = localStorage.getItem('google_user_info');
    
    if (storedToken && storedUserInfo) {
      setAuthState({
        isAuthenticated: true,
        accessToken: storedToken,
        userInfo: JSON.parse(storedUserInfo),
      });
    }

    // Load Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const authenticate = async () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error('Google Client ID não configurado. Configure nas variáveis de ambiente.');
      return;
    }

    try {
      // Initialize Google OAuth
      if (typeof window !== 'undefined' && window.google) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPE,
          callback: (response: any) => {
            if (response.access_token) {
              // Get user info
              fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${response.access_token}`)
                .then(res => res.json())
                .then(userInfo => {
                  // Store token and user info
                  localStorage.setItem('google_access_token', response.access_token);
                  localStorage.setItem('google_user_info', JSON.stringify(userInfo));
                  
                  setAuthState({
                    isAuthenticated: true,
                    accessToken: response.access_token,
                    userInfo,
                  });
                  
                  toast.success('Conectado ao Google com sucesso!');
                })
                .catch(error => {
                  console.error('Error fetching user info:', error);
                  toast.error('Erro ao obter informações do usuário');
                });
            }
          },
          error_callback: (error: any) => {
            console.error('OAuth error:', error);
            toast.error('Erro na autenticação com Google');
          },
        });

        client.requestAccessToken();
      } else {
        toast.error('Google Identity Services não carregado');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast.error('Erro ao conectar com Google');
    }
  };

  const disconnect = () => {
    // Revoke token
    if (authState.accessToken) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${authState.accessToken}`, {
        method: 'POST',
        headers: {
          'Content-type': 'application/x-www-form-urlencoded',
        },
      }).catch(error => {
        console.error('Error revoking token:', error);
      });
    }

    // Clear local storage
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_user_info');

    // Update state
    setAuthState({
      isAuthenticated: false,
      accessToken: null,
      userInfo: null,
    });

    toast.success('Desconectado do Google');
  };

  return {
    ...authState,
    authenticate,
    disconnect,
  };
}

// Extend window interface for Google Identity Services
declare global {
  interface Window {
    google: any;
  }
}