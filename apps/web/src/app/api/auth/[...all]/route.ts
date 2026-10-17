import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

// Rota "catch-all": qualquer /api/auth/* (sign-up/email, sign-in/email, sign-out,
// get-session...) cai aqui e é entregue ao Better Auth, que decide o que fazer.
export const { GET, POST } = toNextJsHandler(auth);
