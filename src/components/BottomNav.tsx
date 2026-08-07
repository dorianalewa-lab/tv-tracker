import { NavLink } from 'react-router-dom';
import { Compass, Library, Sparkles, User } from 'lucide-react';

const tabs = [
  { to: '/',        label: 'Découvrir', icon: Compass,  end: true },
  { to: '/library', label: 'Biblio',    icon: Library,  end: false },
  { to: '/reco',    label: 'Pour toi',  icon: Sparkles, end: false },
  { to: '/profile', label: 'Profil',    icon: User,     end: false },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-surface border-t border-border z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-2.5 text-xs ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
