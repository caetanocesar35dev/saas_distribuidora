"use client";

import {
  BadgeDollarSignIcon,
  BoxesIcon,
  BuildingIcon,
  ChevronsUpDownIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  ContainerIcon,
  CreditCardIcon,
  HomeIcon,
  MegaphoneIcon,
  MenuIcon,
  PackageIcon,
  PlusIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  StoreIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/app/brand";
import { NotificationsBell } from "@/components/app/notifications-bell";
import { SubscriptionBanner } from "@/components/app/subscription-banner";
import { UserMenu } from "@/components/app/user-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Role } from "@/lib/api/types";
import { hasMinRole, ROLE_LABEL } from "@/lib/format";
import { useCompany, useStore } from "@/lib/session/context";
import { useMemberships } from "@/lib/session/queries";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  minRole?: Role;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group, index) => (
        <div key={group.title ?? index} className="flex flex-col gap-0.5">
          {group.title && (
            <p className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.title}
            </p>
          )}
          {group.items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Troca de empresa/loja sempre visível, sem sair da conta. */
function ScopeSwitcher({
  currentLabel,
  currentHint,
  currentStoreId,
}: {
  currentLabel: string;
  currentHint: string;
  currentStoreId?: string;
}) {
  const router = useRouter();
  const memberships = useMemberships();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-auto w-full max-w-72 justify-between gap-2 py-1.5 text-left"
          />
        }
      >
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium">{currentLabel}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{currentHint}</span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {memberships.data?.map((m) => (
          <DropdownMenuGroup key={m.companyId}>
            <DropdownMenuLabel>{m.companyName}</DropdownMenuLabel>
            {m.stores.map((s) => (
              <DropdownMenuItem
                key={s.storeId}
                onClick={() => router.push(`/loja/${s.storeId}`)}
                className={cn(s.storeId === currentStoreId && "bg-muted font-medium")}
              >
                <StoreIcon />
                <span className="flex-1 truncate">{s.storeName}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABEL[s.role]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/selecionar?trocar=1" />}>
          Ver todas as empresas e lojas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Frame({
  groups,
  switcher,
  showSubscription = true,
  children,
}: {
  groups: NavGroup[];
  switcher: React.ReactNode;
  /** A área da plataforma não pertence a nenhuma empresa, então não tem faixa de assinatura. */
  showSubscription?: boolean;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Menu lateral (telas grandes) */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-5 overflow-y-auto border-r bg-sidebar p-4 lg:flex">
        <Link href="/" aria-label="Início">
          <Brand />
        </Link>
        <NavLinks groups={groups} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </Button>
          <div className="min-w-0 flex-1">{switcher}</div>
          <Button
            render={<Link href="/duvidas" />}
            nativeButton={false}
            variant="ghost"
            size="icon"
            aria-label="Dúvidas"
            title="Dúvidas"
          >
            <CircleHelpIcon />
          </Button>
          <NotificationsBell />
          <UserMenu />
        </header>

        {showSubscription && <SubscriptionBanner />}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 gap-5 p-4" showCloseButton>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          <NavLinks groups={groups} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Estrutura das telas de uma loja: `/loja/[storeId]/...`. */
export function StoreShell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const base = `/loja/${store.storeId}`;
  const manager = hasMinRole(store.role, "MANAGER");

  const operation: NavItem[] = [
    { href: base, label: "Início", icon: HomeIcon, exact: true },
    { href: `${base}/pdv`, label: "Vender (PDV)", icon: ShoppingCartIcon },
    { href: `${base}/comandas`, label: "Comandas", icon: ClipboardListIcon },
    { href: `${base}/caixa`, label: "Caixa", icon: WalletIcon },
    { href: `${base}/vendas`, label: "Vendas", icon: ReceiptIcon },
    { href: `${base}/clientes`, label: "Clientes e fiado", icon: UsersIcon },
  ];
  const stock: NavItem[] = [
    { href: `${base}/estoque`, label: "Estoque", icon: BoxesIcon },
    ...(manager
      ? [{ href: `${base}/produtos`, label: "Produtos", icon: PackageIcon }]
      : []),
    { href: `${base}/vasilhames`, label: "Vasilhames", icon: ContainerIcon },
  ];

  const groups: NavGroup[] = [
    { items: operation },
    { title: "Mercadoria", items: stock },
  ];
  if (store.isCompanyOwner) {
    groups.push({
      title: "Empresa",
      items: [
        { href: `/empresa/${store.companyId}`, label: "Painel da empresa", icon: BuildingIcon },
      ],
    });
  }
  groups.push({
    items: [{ href: "/duvidas", label: "Dúvidas", icon: CircleHelpIcon }],
  });

  return (
    <Frame
      groups={groups}
      switcher={
        <ScopeSwitcher
          currentLabel={store.storeName}
          currentHint={`${store.companyName} · ${store.role ? ROLE_LABEL[store.role] : ""}`}
          currentStoreId={store.storeId}
        />
      }
    >
      {children}
    </Frame>
  );
}

/** Estrutura das telas de administração da empresa: `/empresa/[companyId]/...`. */
export function CompanyShell({ children }: { children: React.ReactNode }) {
  const company = useCompany();
  const base = `/empresa/${company.companyId}`;

  const admin: NavItem[] = [
    { href: base, label: "Painel da empresa", icon: HomeIcon, exact: true },
    { href: `${base}/lojas`, label: "Lojas", icon: StoreIcon },
    { href: `${base}/equipe`, label: "Equipe", icon: UsersIcon },
    { href: `${base}/dados`, label: "Dados da empresa", icon: BuildingIcon },
    { href: `${base}/assinatura`, label: "Assinatura", icon: CreditCardIcon },
  ];
  if (company.isBillingOwner) {
    admin.push({ href: `${base}/nova-empresa`, label: "Nova empresa", icon: PlusIcon });
  }

  const groups: NavGroup[] = [
    { title: "Administração", items: admin },
    {
      title: "Lojas",
      items: company.stores.map((s) => ({
        href: `/loja/${s.storeId}`,
        label: s.storeName,
        icon: StoreIcon,
      })),
    },
    { items: [{ href: "/duvidas", label: "Dúvidas", icon: CircleHelpIcon }] },
  ];

  return (
    <Frame
      groups={groups}
      switcher={
        <ScopeSwitcher
          currentLabel={company.companyName}
          currentHint="Administração da empresa"
        />
      }
    >
      {children}
    </Frame>
  );
}

/** Estrutura da área da plataforma (equipe do sistema): `/plataforma/...`. */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const groups: NavGroup[] = [
    {
      title: "Plataforma",
      items: [
        { href: "/plataforma/organizacoes", label: "Organizações", icon: BuildingIcon },
        { href: "/plataforma/planos", label: "Planos", icon: BadgeDollarSignIcon },
        { href: "/plataforma/usuarios", label: "Usuários", icon: UsersIcon },
        { href: "/plataforma/notificacoes", label: "Notificações", icon: MegaphoneIcon },
      ],
    },
    {
      items: [
        { href: "/selecionar?trocar=1", label: "Voltar às lojas", icon: StoreIcon },
        { href: "/duvidas", label: "Dúvidas", icon: CircleHelpIcon },
      ],
    },
  ];

  return (
    <Frame
      groups={groups}
      showSubscription={false}
      switcher={
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium">Área da plataforma</span>
          <span className="text-xs text-muted-foreground">Equipe do sistema</span>
        </div>
      }
    >
      {children}
    </Frame>
  );
}
