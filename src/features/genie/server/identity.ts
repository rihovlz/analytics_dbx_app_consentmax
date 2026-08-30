export type ForwardedGenieIdentity = {
  userId: string;
  accessToken: string;
};

export function extractForwardedGenieIdentity(headers: Headers): ForwardedGenieIdentity | null {
  const userId = headers.get("x-forwarded-user")?.trim();
  const accessToken = headers.get("x-forwarded-access-token")?.trim();
  return userId && accessToken ? { userId, accessToken } : null;
}
