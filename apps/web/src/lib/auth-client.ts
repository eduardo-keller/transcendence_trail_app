import { createAuthClient } from 'better-auth/react';

// Cliente para componentes do navegador ('use client'): authClient.signIn.email(),
// authClient.signUp.email(), authClient.signOut(), authClient.useSession().
// Sem baseURL: front e API estão na mesma origem, então ele chama /api/auth/* direto.
// No servidor, use os helpers de sessão, não este cliente.
export const authClient = createAuthClient();
