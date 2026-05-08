import { useEffect } from "react";

import { useCardImage } from "../../hooks/useCardImage";
import { useDraftStore } from "../../stores/draftStore";
import type { DraftCardInstance } from "../../adapter/draft-adapter";
import type { CardHoverInfo } from "../card/CardPreview";

// ── Card tile ───────────────────────────────────────────────────────────

interface PackCardProps {
  card: DraftCardInstance;
  isSelected: boolean;
  onSelect: (instanceId: string) => void;
  onConfirm: () => void;
  onHover: (info: CardHoverInfo | null) => void;
}

function PackCard({
  card,
  isSelected,
  onSelect,
  onConfirm,
  onHover,
}: PackCardProps) {
  const { src, isLoading } = useCardImage(card.name, {
    size: "normal",
    sourcePrinting: { setCode: card.set_code, collectorNumber: card.collector_number },
  });

  return (
    <div
      className={`relative cursor-pointer overflow-hidden rounded-[14px] transition-all duration-150 ${
        isSelected
          ? "z-10 scale-105 ring-2 ring-amber-400 shadow-lg shadow-amber-400/20"
          : "ring-1 ring-white/10 hover:scale-[1.02] hover:ring-white/20"
      }`}
      onMouseEnter={() => onHover({ name: card.name, sourcePrinting: { setCode: card.set_code, collectorNumber: card.collector_number } })}
      onMouseLeave={() => onHover(null)}
    >
      <button
        onClick={() => onSelect(card.instance_id)}
        className="w-full"
      >
        {isLoading || !src ? (
          <div className="flex aspect-[488/680] animate-pulse items-center justify-center bg-white/5">
            <span className="px-2 text-center text-xs text-white/40">{card.name}</span>
          </div>
        ) : (
          <img
            src={src}
            alt={card.name}
            draggable={false}
            className="aspect-[488/680] w-full object-cover"
          />
        )}
      </button>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
        {isSelected ? (
          <button
            onClick={onConfirm}
            className="w-full rounded-lg bg-amber-500 py-0.5 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Confirm Pick
          </button>
        ) : (
          <span className="line-clamp-1 text-[10px] leading-tight text-white/80">
            {card.name}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Rarity helpers ─────────────────────────────────────────────────────

const RARITY_ORDER = ["mythic", "rare", "uncommon", "common"] as const;

const RARITY_LABELS: Record<string, string> = {
  mythic: "Mythic Rare",
  rare: "Rare",
  uncommon: "Uncommon",
  common: "Common",
};

const RARITY_COLORS: Record<string, string> = {
  mythic: "text-orange-400",
  rare: "text-amber-400",
  uncommon: "text-slate-300",
  common: "text-white/50",
};

function groupByRarity(cards: DraftCardInstance[]) {
  const groups: [string, DraftCardInstance[]][] = [];
  for (const rarity of RARITY_ORDER) {
    const matched = cards.filter((c) => c.rarity === rarity);
    if (matched.length > 0) groups.push([rarity, matched]);
  }
  const unmatched = cards.filter(
    (c) => !RARITY_ORDER.includes(c.rarity as (typeof RARITY_ORDER)[number]),
  );
  if (unmatched.length > 0) groups.push(["other", unmatched]);
  return groups;
}

// ── Main component ──────────────────────────────────────────────────────

interface PackDisplayProps {
  onCardHover: (info: CardHoverInfo | null) => void;
}

export function PackDisplay({ onCardHover }: PackDisplayProps) {
  const view = useDraftStore((s) => s.view);
  const selectedCard = useDraftStore((s) => s.selectedCard);
  const selectCard = useDraftStore((s) => s.selectCard);
  const confirmPick = useDraftStore((s) => s.confirmPick);

  useEffect(() => {
    if (view?.current_pack?.length === 1 && !selectedCard) {
      selectCard(view.current_pack[0].instance_id);
    }
  }, [view?.current_pack, selectedCard, selectCard]);

  if (!view) return null;

  const pack = view.current_pack;

  if (!pack || pack.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-white/40">
        Waiting for next pack...
      </div>
    );
  }

  const sections = groupByRarity(pack);

  return (
    <div className="flex flex-col gap-4">
      {sections.map(([rarity, cards]) => (
        <div key={rarity}>
          <h3
            className={`mb-2 text-xs font-semibold uppercase tracking-wider ${RARITY_COLORS[rarity] ?? "text-white/50"}`}
          >
            {RARITY_LABELS[rarity] ?? rarity}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {cards.map((card) => (
              <PackCard
                key={card.instance_id}
                card={card}
                isSelected={selectedCard === card.instance_id}
                onSelect={selectCard}
                onConfirm={confirmPick}
                onHover={onCardHover}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
