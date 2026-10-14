export default function LoginPage() {
	async function login(formData: FormData) {
		'use server';
		const email = formData.get('email');
		const password = formData.get('password');

		// console.log('tipo do email:\t\t', typeof email, '\tvalor:', email);
		if (typeof email != "string" || typeof password != "string")
		{
			return ;
		}
	}
	return (
		<main>
			<h1>Entrar</h1>
			<form action={login}>
				<label>
					E-mail
					<input name="email" type="email" required /><br/>
				</label>
				<label>
					Senha
					<input name="password" type="password" required /><br/>
				</label>
				<button type="submit">Entrar</button>
			</form>
		</main>
	);
}