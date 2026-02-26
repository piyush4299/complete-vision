import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  is_active: boolean;
  created_at: string;
}

interface AuthContextValue {
  currentUser: TeamMember | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  currentUser: null,
  loading: true,
  login: async () => "Not initialized",
  logout: () => {},
});

const STORAGE_KEY = "cartevent_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as TeamMember;
      supabase
        .from("team_members")
        .select("*")
        .eq("id", parsed.id)
        .eq("is_active", true)
        .single()
        .then(({ data }) => {
          if (data) {
            const user: TeamMember = {
              id: data.id,
              name: data.name,
              email: data.email,
              role: data.role as "admin" | "agent",
              is_active: data.is_active,
              created_at: data.created_at,
            };
            setCurrentUser(user);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
          setLoading(false);
        });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .eq("password", password)
      .eq("is_active", true)
      .single();

    if (error || !data) return "Invalid email or password";

    const user: TeamMember = {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as "admin" | "agent",
      is_active: data.is_active,
      created_at: data.created_at,
    };
    setCurrentUser(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return null;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
