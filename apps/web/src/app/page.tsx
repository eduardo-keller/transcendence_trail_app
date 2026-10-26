import Link from "next/link";

import { NavBar } from "@/components/navbar";

export default function HomePage() {
  return(
    <>
      <NavBar />
      <main>
        <h1>Trilhas SP</h1>
        <p>Descubra, registre e compartible trilhas de São Paulo.</p>
      </main>
    </>
  );
}
