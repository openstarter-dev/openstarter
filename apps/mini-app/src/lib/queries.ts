import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { type InferResponseType, unwrapQuery, withAbort } from "@openstarter/api/client";
import { authClient } from "@/lib/auth-client";
import { client } from "@/services/client";
import { useAuthStore, type UserInfo } from "@/stores/auth-store";

const getProfile = client.api.profile.$get;

type ProfileData = NonNullable<InferResponseType<typeof getProfile, 200>["data"]>;

export const profileKeys = {
  all: ["profile"] as const,
  detail: () => ["profile", "detail"] as const,
};

export const profileQueries = {
  detail: () =>
    queryOptions({
      queryKey: profileKeys.detail(),
      queryFn: async ({ signal }) =>
        unwrapQuery<ProfileData>(
          await getProfile(undefined, withAbort(signal)),
          "Failed to load profile",
        ),
    }),
};

export const authMutations = {
  login: () =>
    mutationOptions({
      mutationFn: async (vars: { email: string; password: string }) => {
        let bearerToken: string | null = null;

        const result = await authClient.signIn.email(vars, {
          onSuccess: (ctx) => {
            bearerToken = ctx.response.headers.get("set-auth-token");
          },
        });

        if (result.error) {
          throw new Error(result.error.message || "Login failed");
        }
        if (!result.data?.user || !bearerToken) {
          throw new Error("Login failed: missing token or user");
        }

        useAuthStore.getState().setSession(bearerToken, result.data.user as UserInfo);
        return result.data;
      },
    }),
  logout: () =>
    mutationOptions({
      meta: { invalidates: [profileKeys.all] },
      mutationFn: async () => {
        await authClient.signOut();
      },
    }),
};
