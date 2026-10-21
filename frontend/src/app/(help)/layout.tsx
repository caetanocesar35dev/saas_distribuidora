import { HelpShell } from "./help-shell";

/** A Central de Dúvidas abre com ou sem login (as dúvidas de acesso precisam funcionar antes de entrar). */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <HelpShell>{children}</HelpShell>;
}
