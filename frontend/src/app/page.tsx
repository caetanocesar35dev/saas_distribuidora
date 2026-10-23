import { redirect } from "next/navigation";

// Sem sessão o proxy já manda para /login; com sessão, a seleção decide a loja.
export default function Home() {
  redirect("/selecionar");
}
