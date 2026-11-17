import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
export default withAuth(function middleware(req) {
  const pathname = req.nextUrl.pathname;
  const role = (req.nextauth.token as any)?.role;
  const requestedRole = pathname.split("/")[2];
  if (["requester", "technician", "admin"].includes(requestedRole) && requestedRole !== role) {
    return NextResponse.redirect(new URL(`/dashboard/${role || "requester"}`, req.url));
  }
  return NextResponse.next();
}, { pages: { signIn: "/login" } });
export const config = { matcher: ["/dashboard/:path*"] };
