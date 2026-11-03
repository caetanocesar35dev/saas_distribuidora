/** Canais de contato do suporte: um lugar só, usado na página de apresentação e na Central de Dúvidas. */

const WHATSAPP_NUMBER = "5531975623307";

export const WHATSAPP_DISPLAY = "(31) 97562-3307";

export const INSTAGRAM_URL = "https://www.instagram.com/minhadistribuidoraonline_/";
export const INSTAGRAM_HANDLE = "@minhadistribuidoraonline_";

export const SALES_MESSAGE = "Olá! Quero saber mais sobre o Minha Distribuidora Online.";
export const SUPPORT_MESSAGE = "Olá! Preciso de ajuda com o Minha Distribuidora Online.";

/** Abre a conversa no WhatsApp com a mensagem já escrita. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
