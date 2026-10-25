import Link from 'next/link';
import { LegalPage } from '../_components/legal-page';

export const metadata = { title: 'Política de Privacidade · Trilhas SP' };

export default function PrivacyPage() {
	return (
		<LegalPage title="Política de Privacidade">
			<p>
				A Trilhas SP é um projeto acadêmico da 42 São Paulo. Esta página explica quais dados pessoais guardamos, para quê, com
				quem são compartilhados e como você exerce os seus direitos previstos na LGPD (Lei 13.709/2018) e no GDPR.
			</p>

			<section>
				<h2>Que dados guardamos</h2>
				<ul>
					<li>
						<strong>Conta:</strong> nome, e-mail, nome de usuário, bio e foto de perfil. A senha nunca é guardada: só um hash
						com salt (scrypt), que não dá para reverter.
					</li>
					<li>
						<strong>Segurança:</strong> sessões ativas (data, endereço IP e navegador), se a verificação em duas etapas está
						ligada (o segredo fica cifrado) e as contas do GitHub ou da 42 que você conectar.
					</li>
					<li>
						<strong>Uso do app:</strong> trilhas que você publica (públicas ou privadas), atividades que registra com seus
						percursos, amigos, mensagens, notificações, XP e emblemas.
					</li>
					<li>
						<strong>Assistente de IA:</strong> as perguntas que você faz e as respostas geradas.
					</li>
				</ul>
			</section>

			<section>
				<h2>Para que usamos e com que base legal</h2>
				<ul>
					<li>Criar e manter a sua conta e mostrar o seu perfil, trilhas e atividades: execução do serviço que você pediu.</li>
					<li>
						Proteger a sua conta (sessões, IP, limite de tentativas de login, verificação em duas etapas): legítimo interesse
						em segurança.
					</li>
					<li>E-mails sobre a sua conta (exportação e exclusão de dados): cumprimento dos seus direitos de titular.</li>
				</ul>
				<p>Não vendemos dados, não mostramos anúncios e não usamos os seus dados para treinar modelos de IA.</p>
			</section>

			<section>
				<h2>Quem vê o quê</h2>
				<ul>
					<li>
						<strong>Qualquer pessoa:</strong> o seu perfil público (nome, nome de usuário, bio, foto e estatísticas de
						atividades) e as trilhas que você marcar como públicas. O seu e-mail nunca aparece.
					</li>
					<li>
						<strong>Só você:</strong> e-mail, sessões, trilhas privadas e as configurações da conta.
					</li>
					<li>
						<strong>Seus amigos:</strong> se você está online e as mensagens que vocês trocam.
					</li>
				</ul>
			</section>

			<section>
				<h2>Dados enviados a terceiros</h2>
				<ul>
					<li>
						<strong>Login pelo GitHub ou pela 42:</strong> se você escolher, o provedor nos envia o seu nome, e-mail e foto.
						O provedor fica sabendo que você entrou na Trilhas SP.
					</li>
					<li>
						<strong>Assistente de IA:</strong> a sua pergunta e os trechos das trilhas usados como contexto são enviados a um
						provedor externo de modelos de linguagem para gerar a resposta. Não envie dados pessoais nas perguntas.
					</li>
					<li>
						<strong>Mapa:</strong> as imagens do mapa vêm de um servidor de mapas do OpenStreetMap, que recebe o seu endereço
						IP e a área do mapa que você está vendo.
					</li>
				</ul>
			</section>

			<section>
				<h2>Onde ficam e por quanto tempo</h2>
				<p>
					Os dados ficam num banco de dados PostgreSQL no servidor do projeto, acessado só pelo próprio app, por conexão
					protegida (HTTPS). Guardamos os dados enquanto a sua conta existir. As sessões expiram em 7 dias sem uso. Ao excluir
					a conta, todos os seus dados são apagados do banco na hora.
				</p>
			</section>

			<section>
				<h2>Cookies e armazenamento no aparelho</h2>
				<ul>
					<li>
						<strong>Cookie de sessão</strong> (<code>__Secure-better-auth.session_token</code>): mantém você logado. É{' '}
						<code>HttpOnly</code> (o JavaScript da página não lê), <code>Secure</code> (só trafega por HTTPS) e{' '}
						<code>SameSite=Lax</code>.
					</li>
					<li>
						<strong>Cookies temporários</strong> durante o login pelo GitHub ou pela 42 e na verificação em duas etapas, apagados
						ao final.
					</li>
					<li>
						<strong>Cache offline:</strong> o app instalado guarda no seu aparelho as páginas e trilhas que você já visitou,
						para funcionar sem internet. Apague pelas configurações do navegador.
					</li>
				</ul>
				<p>Não usamos cookies de publicidade nem de rastreamento.</p>
			</section>

			<section>
				<h2>Seus direitos e como exercê-los</h2>
				<ul>
					<li>
						<strong>Acesso e portabilidade:</strong> baixe todos os seus dados em JSON em{' '}
						<Link href="/conta/dados" className="font-bold text-forest underline">
							Privacidade e dados
						</Link>
						. Avisamos por e-mail a cada exportação.
					</li>
					<li>
						<strong>Correção:</strong> edite nome, nome de usuário, bio e foto em{' '}
						<Link href="/conta" className="font-bold text-forest underline">
							Minha conta
						</Link>
						.
					</li>
					<li>
						<strong>Exclusão:</strong> exclua a conta em{' '}
						<Link href="/conta/dados" className="font-bold text-forest underline">
							Privacidade e dados
						</Link>
						. Pedimos a sua senha e uma confirmação pelo link enviado ao seu e-mail.
					</li>
					<li>
						<strong>Revogar acessos:</strong> encerre sessões em outros dispositivos e desconecte provedores em Minha conta.
					</li>
				</ul>
			</section>

			<section>
				<h2>Contato</h2>
				<p>
					Dúvidas sobre privacidade: abra uma issue no{' '}
					<a href="https://github.com/eduardo-keller/transcendence_trail_app" className="font-bold text-forest underline">
						repositório do projeto
					</a>
					. O time responde pelo tratamento dos dados enquanto o projeto estiver no ar.
				</p>
			</section>
		</LegalPage>
	);
}
