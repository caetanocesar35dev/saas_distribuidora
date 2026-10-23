import { StoreShell } from "@/components/app/shell";
import { StoreProvider } from "@/lib/session/context";

export default async function StoreLayout({ children, params }: LayoutProps<"/loja/[storeId]">) {
  const { storeId } = await params;
  return (
    <StoreProvider storeId={storeId}>
      <StoreShell>{children}</StoreShell>
    </StoreProvider>
  );
}
