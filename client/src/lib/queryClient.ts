import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Throws an error with the HTTP status and response body if the response is not OK.
 * @param res - The fetch Response to check.
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Sends a JSON API request and throws if the response is not OK.
 * @param method - HTTP method ("GET", "POST", "PATCH", "DELETE", etc.).
 * @param url - The request URL.
 * @param data - Optional request body; serialised to JSON if provided.
 * @returns The raw fetch Response (caller is responsible for .json() etc.).
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Higher-order function that returns a TanStack Query `queryFn`.
 * The queryKey is joined with "/" to form the fetch URL (e.g. ["/api/agents"] → "/api/agents").
 * @param options.on401 - "throw" to bubble 401s as errors; "returnNull" to silently return null
 *   (used for optional auth checks where an unauthenticated state is valid).
 * @returns A QueryFunction suitable for use as a TanStack Query default queryFn.
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Shared TanStack Query client for the application.
 * staleTime is Infinity because all mutations explicitly invalidate affected queries,
 * so background refetches are unnecessary — data is only ever re-fetched when invalidated.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
