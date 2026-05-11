import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

/**
 * Returns the current authenticated user and loading state.
 * Uses "returnNull" on 401 so unauthenticated state is not treated as an error.
 */
export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
  };
}
