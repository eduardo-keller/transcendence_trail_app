import Link from "next/link";

export function NavBar() {
  return (
    <main>
      <h1>Trilhas SP</h1>
      <nav>
        <ul className="flex justify-end gap-4 p-4">
          <li><Link href="/login">Entrar</Link></li>
          <li><Link href="/cadastro">Cadastro</Link></li>
          <li><Link href="/conta">Conta</Link></li>
          <li><Link href="/profile">Perfil</Link></li>
          <li><Link href="/termos">Termos</Link></li>
          <li><Link href="/privacidade">Privacidade</Link></li>
        </ul>
      </nav>
    </main>
  );
}
