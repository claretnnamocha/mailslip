import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      mustChangePassword?: boolean;
    };
  }

  interface User {
    loginName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    mustChangePassword?: boolean;
  }
}
