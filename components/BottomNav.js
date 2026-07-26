'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/dashboard', label: 'Mots du jour', icon: '◆' },
  { href: '/dashboard/scenarios', label: 'Scénarios', icon: '◈' },
  { href: '/dashboard/progression', label: 'Progression', icon: '◉' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-line flex px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold ${
              active ? 'text-sageDark' : 'text-inkSoft'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
