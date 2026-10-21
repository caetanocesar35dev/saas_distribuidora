"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError, apiEvents, errorMessage } from "@/lib/api/client";
import { sessionKeys } from "@/lib/session/queries";

const PUBLIC_PREFIXES = ["/login", "/cadastro", "/esqueci-a-senha", "/redefinir-senha", "/duvidas"];

function shouldRetry(failureCount: number, error: unknown) {
  // Erros do servidor sobre a requisição (4xx) não melhoram tentando de novo.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

function makeClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache({
      // Toda falha de gravação mostra a mensagem do backend (já em português), a menos que a tela
      // trate o erro por conta própria (`meta: { silent: true }`).
      onError(error, _variables, _context, mutation) {
        if (mutation.meta?.silent) return;
        if (error instanceof ApiError && error.status === 401) return;
        toast.error(errorMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeClient);

  useEffect(() => {
    let redirecting = false;
    const offUnauthorized = apiEvents.onUnauthorized(() => {
      const path = window.location.pathname;
      if (redirecting || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return;
      redirecting = true;
      const next = encodeURIComponent(path + window.location.search);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa de propósito: zera o cache e o estado em memória
      window.location.href = `/login?next=${next}`;
    });
    const offReadOnly = apiEvents.onReadOnly(() => {
      // A assinatura pode ter mudado com a tela aberta: recarrega o estado e avisa.
      void client.invalidateQueries({ queryKey: sessionKeys.memberships });
    });
    return () => {
      offUnauthorized();
      offReadOnly();
    };
  }, [client]);

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
