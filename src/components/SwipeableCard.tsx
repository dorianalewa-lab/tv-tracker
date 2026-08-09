import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  isOpen: boolean;                    // contrôlé par le parent (pour fermer les autres cards)
  onOpen: () => void;                 // appelé quand cette card s'ouvre → parent ferme les autres
  onCloseRequest: () => void;         // appelé quand tap ailleurs / delete → parent marque fermé
};

const REVEAL = 84;      // largeur visible du bouton delete
const TRIGGER = 40;     // distance min pour qu'un swipe "stick" en position ouverte

/**
 * Wrapper qui ajoute un swipe-to-delete iOS-style à n'importe quel contenu.
 * Tap ailleurs sur la carte quand elle est ouverte = referme (sans navigation).
 * Le parent gère un `openId` global pour ne garder qu'une carte ouverte à la fois.
 */
export function SwipeableCard({ children, onDelete, isOpen, onOpen, onCloseRequest }: Props) {
  const [dragOffset, setDragOffset] = useState<number | null>(null);   // null = pas en train de drag
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const swipingRef = useRef(false);                                     // true si on a détecté un swipe (pas un scroll vertical)

  // Offset final = drag en cours OU état ouvert/fermé
  const offset = dragOffset ?? (isOpen ? -REVEAL : 0);

  function onTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    swipingRef.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;

    // Décide la première fois qu'on bouge : swipe horizontal vs scroll vertical
    if (!swipingRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      swipingRef.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!swipingRef.current) return;

    // Autorise seulement le swipe gauche, avec un peu de bounce à droite
    const base = isOpen ? -REVEAL : 0;
    const raw = base + dx;
    const clamped = Math.max(-REVEAL - 20, Math.min(20, raw));
    setDragOffset(clamped);
  }

  function onTouchEnd() {
    if (dragOffset == null) return;
    const shouldOpen = dragOffset < -TRIGGER;
    setDragOffset(null);
    if (shouldOpen && !isOpen) onOpen();
    else if (!shouldOpen && isOpen) onCloseRequest();
  }

  // Ferme au clic (capture avant le Link enfant) quand ouvert
  function onClickCapture(e: React.MouseEvent) {
    if (isOpen) {
      e.preventDefault();
      e.stopPropagation();
      onCloseRequest();
    }
  }

  // Sécurité : si offset change quand parent close, revient à 0 en animation
  useEffect(() => {
    if (!isOpen) setDragOffset(null);
  }, [isOpen]);

  return (
    <div className="relative overflow-hidden rounded-md">
      {/* Bouton delete rouge derrière — révélé par le swipe */}
      <button
        onClick={onDelete}
        aria-label="Retirer de la biblio"
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 bg-red-500 text-white font-medium text-[11px]"
        style={{ width: REVEAL }}
      >
        <Trash2 size={20} />
        <span>Retirer</span>
      </button>

      {/* Contenu draggable */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={onClickCapture}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragOffset == null ? 'transform 220ms cubic-bezier(0.4,0,0.2,1)' : 'none',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
