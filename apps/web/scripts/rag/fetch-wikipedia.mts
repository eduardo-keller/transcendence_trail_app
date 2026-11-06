// Baixa da Wikipedia em português os artigos do corpus do RAG e grava em prisma/data/rag/wikipedia.json.
// Roda uma vez (ou para atualizar); o app nunca chama a Wikipedia. Não usa o Gemini.
//
// uso: docker compose -f docker/docker-compose.yml exec nextjs node scripts/rag/fetch-wikipedia.mts
//
// Licença: CC BY-SA 4.0. A resposta do assistente cita o título e o link de cada artigo usado.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', '..', 'prisma', 'data', 'rag', 'wikipedia.json');
const API = 'https://pt.wikipedia.org/w/api.php';
// A Wikimedia pede um User-Agent que identifique o programa
const USER_AGENT = 'TrilhasSP-RAG/1.0 (https://github.com/eduardo-keller/transcendence_trail_app; projeto academico da 42 SP)';
// Um pedido por vez, com pausa: a API recusa (429) quem pede rápido demais
const PAUSE_MS = 1000;

// Parques, picos, serras e represas da região do catálogo (Grande SP, Cantareira, Jaraguá, Atibaia,
// Paranapiacaba, Morro Grande, extremo sul), os municípios onde ficam as trilhas, a Mata Atlântica,
// fauna e flora que se encontram nelas e temas de segurança com artigo próprio.
export const ARTICLES = [
	// Áreas protegidas e parques
	'Parque Estadual da Cantareira',
	'Serra da Cantareira',
	'Parque Estadual do Jaraguá',
	'Pico do Jaraguá',
	'Horto Florestal de São Paulo',
	'Parque Estadual do Juquery',
	'Parque Anhanguera (São Paulo)',
	'Parque Ecológico do Tietê',
	'Parque Ibirapuera',
	'Parque Estadual Serra do Mar',
	'Núcleo Curucutu',
	'Serra do Mar',
	'Paranapiacaba',
	'Reserva Florestal do Morro Grande',
	'Monumento Natural Estadual da Pedra Grande',
	'Parque Estadual de Itapetinga',
	'Parque Estadual de Itaberaba',
	'Serra do Japi',
	'Cratera de Colônia',
	'Calçada do Lorena',
	'Rodovia Caminho do Mar',
	'Estrada de Ferro Perus-Pirapora',
	'Estrada de Ferro Santos-Jundiaí',
	'Reserva da Biosfera do Cinturão Verde de São Paulo',
	'Terra Indígena Jaraguá',
	// Represas e rios
	'Represa Billings',
	'Represa de Guarapiranga',
	'Sistema Cantareira',
	'Rio Tietê',
	'Rio Juqueri',
	'Rio Cotia',
	// Municípios e distritos
	'Atibaia',
	'Mairiporã',
	'Caieiras',
	'Franco da Rocha',
	'Pirapora do Bom Jesus',
	'Santana de Parnaíba',
	'Cotia',
	'Embu-Guaçu',
	'Juquitiba',
	'São Lourenço da Serra',
	'Itapecerica da Serra',
	'Parelheiros',
	'Marsilac',
	'Perus',
	'Santo André (São Paulo)',
	'Ribeirão Pires',
	'Rio Grande da Serra',
	'São Bernardo do Campo',
	'Cubatão',
	'Guarulhos',
	'Jundiaí',
	'Jarinu',
	'Região Metropolitana de São Paulo',
	'Clima da cidade de São Paulo',
	// Mata Atlântica, fauna e flora
	'Mata Atlântica',
	'Floresta ombrófila densa',
	'Sistema Nacional de Unidades de Conservação da Natureza',
	'Bugio-ruivo',
	'Sagui-de-tufos-pretos',
	'Macaco-prego',
	'Quati',
	'Gambá',
	'Cachorro-do-mato',
	'Jaguatirica',
	'Puma concolor',
	'Esquilo',
	'Tucano-de-bico-verde',
	'Sabiá-laranjeira',
	'Tiê-sangue',
	'Jacuguaçu',
	'Araucária',
	'Içara (palmeira)',
	'Embaúba',
	'Manacá-da-serra',
	'Quaresmeira',
	'Xaxim',
	'Jequitibá-rosa',
	// Saúde e segurança
	'Bothrops',
	'Cobra-coral',
	'Cascavel-sul-americana',
	'Lista de cobras peçonhentas do Brasil',
	'Escorpião-amarelo',
	'Febre maculosa',
	'Amblyomma cajennense',
	'Febre amarela',
	'Hipotermia',
	'Insolação',
	'Caminhada',
	'Montanhismo',
];

// Seções que não ajudam a responder sobre trilhas (e só aumentariam o corpus)
const SKIP_SECTION =
	/^(Referências|Notas|Notas e referências|Ver também|Ligações externas|Bibliografia|Leitura adicional|Galeria|Galeria de imagens|Política|Política e administração|Administração|Esporte|Esportes|Comunicações|Feriados|Cidades-irmãs|Imprensa|Mídia|Filmografia|Na cultura popular)$/i;

type Page = {
	title: string;
	missing?: boolean;
	extract?: string;
	fullurl?: string;
	revisions?: { revid: number }[];
};

// O texto vem com os títulos de seção como "== História ==" (exsectionformat=wiki)
function clean(text: string): string {
	const lines: string[] = [];
	let skipping = false;
	for (const line of text.split('\n')) {
		const heading = line.match(/^(={2,})\s*(.+?)\s*\1$/);
		if (heading) {
			// Pular uma seção de nível 2 pula as subseções dela
			if (heading[1].length === 2) skipping = SKIP_SECTION.test(heading[2]);
			if (skipping) continue;
			lines.push('', heading[2], '');
			continue;
		}
		if (!skipping) lines.push(line.trim());
	}
	return lines
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

async function fetchArticle(title: string): Promise<Page> {
	const params = new URLSearchParams({
		action: 'query',
		format: 'json',
		formatversion: '2',
		redirects: '1',
		prop: 'extracts|info|revisions',
		explaintext: '1',
		exsectionformat: 'wiki',
		inprop: 'url',
		rvprop: 'ids',
		titles: title,
	});
	for (let attempt = 1; ; attempt += 1) {
		const response = await fetch(`${API}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
		if (response.ok) {
			const body = (await response.json()) as { query: { pages: Page[] } };
			return body.query.pages[0];
		}
		if (response.status !== 429 || attempt === 5) throw new Error(`HTTP ${response.status} em "${title}"`);
		const wait = Number(response.headers.get('retry-after')) || 10 * attempt;
		console.log(`  (429: esperando ${wait} s)`);
		await new Promise((resolve) => setTimeout(resolve, wait * 1000));
	}
}

const articles: { title: string; url: string; revisionId: number; text: string }[] = [];
const missing: string[] = [];
for (const requested of ARTICLES) {
	const page = await fetchArticle(requested);
	if (page.missing || !page.extract || !page.fullurl) {
		missing.push(requested);
		continue;
	}
	const text = clean(page.extract);
	if (articles.some((article) => article.title === page.title)) continue; // dois nomes para o mesmo artigo
	articles.push({ title: page.title, url: page.fullurl, revisionId: page.revisions?.[0]?.revid ?? 0, text });
	console.log(`  ${String(text.length).padStart(7)}  ${page.title}${page.title !== requested ? `  (pedido: ${requested})` : ''}`);
	await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

articles.sort((a, b) => a.title.localeCompare(b.title, 'pt'));
mkdirSync(join(OUT, '..'), { recursive: true });
writeFileSync(
	OUT,
	`${JSON.stringify(
		{
			source: 'Wikipedia em português (pt.wikipedia.org)',
			license: 'CC BY-SA 4.0',
			fetchedAt: new Date().toISOString().slice(0, 10),
			articles,
		},
		null,
		'\t',
	)}\n`,
);

const chars = articles.reduce((sum, article) => sum + article.text.length, 0);
console.log(`\n${articles.length} artigos, ${chars.toLocaleString('en')} caracteres → ${OUT}`);
if (missing.length > 0) console.log(`Não encontrados (${missing.length}): ${missing.join(' · ')}`);
