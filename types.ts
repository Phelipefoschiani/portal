
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'rep';
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}
