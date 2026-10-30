import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

import { api } from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'cognita_token';
const USER_KEY = 'cognita_user';

export function AuthProvider({ children }) {
  // ------------------------------------------------------------
  // Restore token from localStorage
  // ------------------------------------------------------------

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error(
        'Failed to restore authentication token:',
        error
      );
      return null;
    }
  });

  // ------------------------------------------------------------
  // Restore user from localStorage
  // ------------------------------------------------------------

  const [user, setUser] = useState(() => {
    try {
      const raw =
        localStorage.getItem(USER_KEY);

      return raw
        ? JSON.parse(raw)
        : null;
    } catch (error) {
      console.error(
        'Failed to restore user:',
        error
      );

      return null;
    }
  });

  // ------------------------------------------------------------
  // Authentication restoration/loading state
  // ------------------------------------------------------------

  const [loading, setLoading] =
    useState(false);

  // ------------------------------------------------------------
  // Persist token
  // ------------------------------------------------------------

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem(
          TOKEN_KEY,
          token
        );
      } else {
        localStorage.removeItem(
          TOKEN_KEY
        );
      }
    } catch (error) {
      console.error(
        'Failed to persist authentication token:',
        error
      );
    }
  }, [token]);

  // ------------------------------------------------------------
  // Persist user
  // ------------------------------------------------------------

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(
          USER_KEY,
          JSON.stringify(user)
        );
      } else {
        localStorage.removeItem(
          USER_KEY
        );
      }
    } catch (error) {
      console.error(
        'Failed to persist user:',
        error
      );
    }
  }, [user]);

  // ------------------------------------------------------------
  // Login
  // ------------------------------------------------------------

  const login = useCallback(
    (newToken, newUser) => {
      if (!newToken) {
        console.error(
          'Login attempted without a token.'
        );
        return;
      }

      setToken(newToken);

      if (newUser) {
        setUser(newUser);
      }
    },
    []
  );

  // ------------------------------------------------------------
  // Register
  // ------------------------------------------------------------

  const register = useCallback(
    async (name, email, password) => {
      setLoading(true);

      try {
        const result =
          await api.register(
            name,
            email,
            password
          );

        console.log(
          'Registration API response:',
          result
        );

        /*
         * Supported response formats:
         *
         * {
         *   token: "...",
         *   user: {...}
         * }
         *
         * OR:
         *
         * {
         *   success: true,
         *   data: {
         *     token: "...",
         *     user: {...}
         *   }
         * }
         */

        const data =
          result?.data ?? result;

        const newToken =
          data?.token ||
          data?.access_token ||
          result?.token ||
          result?.access_token;

        const newUser =
          data?.user ||
          result?.user;

        if (newToken) {
          setToken(newToken);
        }

        if (newUser) {
          setUser(newUser);
        }

        return result;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);

    try {
      localStorage.removeItem(
        TOKEN_KEY
      );

      localStorage.removeItem(
        USER_KEY
      );
    } catch (error) {
      console.error(
        'Failed to clear authentication storage:',
        error
      );
    }
  }, []);

  // ------------------------------------------------------------
  // Context value
  // ------------------------------------------------------------

  const value = {
    token,
    user,

    isAuthenticated:
      Boolean(token),

    loading,

    login,
    register,
    logout,

    setLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ------------------------------------------------------------
// useAuth hook
// ------------------------------------------------------------

export function useAuth() {
  const ctx =
    useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}