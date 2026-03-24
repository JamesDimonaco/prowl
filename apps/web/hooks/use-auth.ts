"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { identifyUser, resetUser } from "@/lib/posthog";

export function useAuth() {
  const session = authClient.useSession();
  const user = session.data?.user ?? null;

  // Identify user in PostHog when they log in
  useEffect(() => {
    if (user) {
      identifyUser(user.id, {
        email: user.email,
        name: user.name,
      });
    }
  }, [user]);

  return {
    user,
    session: session.data?.session ?? null,
    isLoading: session.isPending,
    isAuthenticated: !!user,
    signOut: () => {
      resetUser();
      authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } });
    },
  };
}
