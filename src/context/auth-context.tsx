import React, { createContext, useContext, useState } from 'react';

export interface User {
  name: string;
  email: string;
  role: string;
  plant: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
}

const defaultUser: User = {
  name: 'Alex Johnson',
  email: 'admin@onemodo.com',
  role: 'Operations & Plant Manager',
  plant: 'South City Batching Plant #1',
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  const login = (email: string, pass: string) => {
    // Allows demo login or any non-empty credentials for rapid testing
    if (email.trim().length > 0) {
      setUser({
        ...defaultUser,
        email: email.trim(),
      });
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
