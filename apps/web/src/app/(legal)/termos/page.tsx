import Link from 'next/link';
import { LegalPage } from '../_components/legal-page';

export const metadata = { title: 'Termos de Uso · Trilhas SP' };

export default function TermsPage() {
	return (
		<LegalPage title="Termos de Uso">
			<p>
				Ao criar uma conta ou usar a Trilhas SP, você concorda com estes termos. A Trilhas SP é um projeto acadêmico da 42 São
				Paulo, sem fins comerciais, feito por estudantes para a avaliação do projeto ft_transcendence.
			</p>

			<section>
				<h2>Quem pode usar</h2>
				<p>
					Pessoas com 18 anos ou mais, ou com autorização de um responsável. Cada conta é pessoal: você responde pelo que for
					feito com ela. Mantenha a senha em segredo e, se possível, ligue a verificação em duas etapas.
				</p>
			</section>

			<section>
				<h2>Aviso de segurança</h2>
				<p>
					<strong>Fazer trilha envolve riscos</strong>: quedas, mudanças de tempo, animais, falta de sinal de celular e
					cansaço, entre outros. Os dados das trilhas (percurso, distância, desnível, dificuldade e tempo estimado) vêm de
					fontes abertas e de outros usuários e <strong>podem estar imprecisos, desatualizados ou errados</strong>. Eles não
					substituem mapas oficiais, guias locais nem o seu julgamento.
				</p>
				<ul>
					<li>Planeje a saída, avise alguém sobre o seu roteiro e o horário de volta e leve água, comida e lanterna.</li>
					<li>Confira as condições do tempo e se a trilha está aberta, inclusive se exige autorização ou guia.</li>
					<li>Respeite os seus limites. A decisão de fazer uma trilha e a responsabilidade por ela são suas.</li>
				</ul>
			</section>

			<section>
				<h2>Assistente de IA</h2>
				<p>
					As respostas do assistente e os planos de trilha são gerados automaticamente por um modelo de linguagem e{' '}
					<strong>podem conter erros</strong>, inclusive sobre segurança, horários e acessos. Confira as informações
					importantes em outras fontes antes de sair.
				</p>
			</section>

			<section>
				<h2>Regras de conduta</h2>
				<ul>
					<li>Não publique conteúdo ilegal, ofensivo, discriminatório, de assédio ou que exponha dados de outras pessoas.</li>
					<li>Não publique trilhas falsas ou perigosas de propósito, nem dentro de áreas onde a entrada é proibida.</li>
					<li>No chat, respeite quem não quer conversar. Não envie spam.</li>
					<li>Não tente acessar contas ou dados de outras pessoas nem atrapalhar o funcionamento do serviço.</li>
				</ul>
				<p>Conteúdo que viole estas regras pode ser removido, e a conta responsável, suspensa ou excluída.</p>
			</section>

			<section>
				<h2>O que você publica</h2>
				<p>
					Trilhas, atividades, fotos e mensagens continuam sendo suas. Ao publicá-las como públicas, você permite que outros
					usuários as vejam dentro do app. Você pode editar ou apagar o que publicou a qualquer momento.
				</p>
			</section>

			<section>
				<h2>Atribuições e licenças</h2>
				<ul>
					<li>
						Dados de mapa e trilhas ©{' '}
						<a href="https://www.openstreetmap.org/copyright" className="font-bold text-forest underline">
							contribuidores do OpenStreetMap
						</a>
						, sob a licença ODbL. O catálogo derivado também está sob ODbL.
					</li>
					<li>
						Trechos da Wikipedia usados pelo assistente estão sob a licença CC BY-SA, com a fonte citada em cada resposta.
					</li>
					<li>Outras fontes de dados, quando usadas, são creditadas na página em que aparecem.</li>
				</ul>
			</section>

			<section>
				<h2>Limitação de responsabilidade</h2>
				<p>
					O serviço é oferecido como está, sem garantia de que estará sempre disponível ou livre de erros. Por ser um projeto
					acadêmico, pode sair do ar ou ser encerrado a qualquer momento. O time não responde por danos decorrentes do uso das
					informações de trilhas ou das respostas do assistente.
				</p>
			</section>

			<section>
				<h2>Encerramento da conta</h2>
				<p>
					Você pode excluir a sua conta quando quiser em{' '}
					<Link href="/conta/dados" className="font-bold text-forest underline">
						Privacidade e dados
					</Link>
					. Todos os seus dados são apagados, como explica a{' '}
					<Link href="/privacidade" className="font-bold text-forest underline">
						Política de Privacidade
					</Link>
					.
				</p>
			</section>

			<section>
				<h2>Mudanças nestes termos</h2>
				<p>
					Se os termos mudarem, a data no topo desta página é atualizada. Dúvidas: abra uma issue no{' '}
					<a href="https://github.com/eduardo-keller/transcendence_trail_app" className="font-bold text-forest underline">
						repositório do projeto
					</a>
					.
				</p>
			</section>
		</LegalPage>
	);
}
