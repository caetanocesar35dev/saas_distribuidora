import { describe, expect, it } from "vitest";
import {
  averageTicket,
  channelLabel,
  channelShare,
  defaultChannelId,
  effectiveChannelId,
} from "./sale-channels";

const channels = [
  { id: "ifood", isDefault: false },
  { id: "balcao", isDefault: true },
];

describe("origem da venda", () => {
  it("o PDV já marca a origem padrão; sem padrão, a primeira", () => {
    expect(defaultChannelId(channels)).toBe("balcao");
    expect(defaultChannelId([{ id: "a", isDefault: false }])).toBe("a");
    expect(defaultChannelId([])).toBeUndefined();
    expect(defaultChannelId(undefined)).toBeUndefined();
  });

  it("vale a escolhida; se ela sumiu da lista, volta para a padrão", () => {
    expect(effectiveChannelId("ifood", channels)).toBe("ifood");
    expect(effectiveChannelId("excluida", channels)).toBe("balcao");
    expect(effectiveChannelId(undefined, channels)).toBe("balcao");
  });

  it("venda de antes da origem aparece como Sem origem", () => {
    expect(channelLabel(null)).toBe("Sem origem");
    expect(channelLabel({ id: "x", name: "iFood" })).toBe("iFood");
  });

  it("participação e ticket médio", () => {
    expect(channelShare(25, 100)).toBe(25);
    expect(channelShare(1, 3)).toBe(33);
    expect(channelShare(10, 0)).toBe(0);
    expect(averageTicket(100, 3)).toBe(33.33);
    expect(averageTicket(50, 0)).toBe(0);
  });
});
