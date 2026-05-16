import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

/**
 * Returns the current authenticated user and loading state.
 * Includes an 8-second AbortController timeout so the app never hangs
 * indefinitely if the server is slow to respond on /auth/me.
 * Returns null (shows LoginPage) on 401, timeout, or any network error.
 */
export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/auth/me"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch("/auth/me", {
          credentials: "include",
          signal: controller.signal,
        });
        if (res.status === 401) return null;
        if (!res.ok) return null;
        return await res.json() as User;
      } catch {
        // Covers AbortError (timeout), network errors, and server unavailable
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
  };
}
