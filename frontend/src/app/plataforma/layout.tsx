import { PlatformShell } from "@/components/app/shell";
import { PlatformProvider } from "@/lib/session/platform";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <PlatformShell>{children}</PlatformShell>
    </PlatformProvider>
  );
}
