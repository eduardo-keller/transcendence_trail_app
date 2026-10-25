// Erros que o Better Auth devolve na URL (?error=...) quando o OAuth falha
export function oauthErrorMessage(error?: string) {
	if (!error) return undefined;
	if (error === 'account_not_linked') {
		return 'Já existe uma conta com esse e-mail. Entre com a senha e conecte o provedor em Minha conta.';
	}
	if (error === 'access_denied') return 'Você cancelou o login no provedor.';
	if (error === "email_doesn't_match" || error === 'email_does_not_match') return 'Essa conta do provedor já está ligada a outro usuário.';
	return 'Não foi possível entrar pelo provedor. Tente de novo.';
}
