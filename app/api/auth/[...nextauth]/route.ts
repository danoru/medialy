// Auth.js (NextAuth v5) catch-all route. The exported `handlers` object from
// `lib/auth.ts` provides `{ GET, POST }` covering every /api/auth/* endpoint
// Auth.js needs (signin, signout, callback, csrf, session, etc.).
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
