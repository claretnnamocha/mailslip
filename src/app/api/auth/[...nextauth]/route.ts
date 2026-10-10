import { handlers } from "@/lib/auth";

// Header host rewrite lives in middleware. Avoid re-wrapping the Request body
// here — cloning POST bodies with duplex can hang credentials sign-in.
export const { GET, POST } = handlers;
