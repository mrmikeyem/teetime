export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/tee-times/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/feedback/:path*",
    "/teams/:path*",
  ],
};
