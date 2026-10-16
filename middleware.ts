import { NextRequest, NextResponse } from "next/server";

function hasValidPassword(request: NextRequest, expectedPassword: string) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    return separator >= 0 && decoded.slice(separator + 1) === expectedPassword;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const password = process.env.APP_ACCESS_PASSWORD;
  if (!password || hasValidPassword(request, password)) {
    return NextResponse.next();
  }

  return new NextResponse("请输入访问密码后再使用邮件回复助手。", {
    status: 401,
    headers: {
      // HTTP authentication headers must stay within the ByteString range.
      "WWW-Authenticate": 'Basic realm="Mail Reply Studio"'
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
