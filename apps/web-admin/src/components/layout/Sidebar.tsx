import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuth } from '../../hooks/useAdminAuth.js';
import { get } from '../../lib/apiClient.js';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

function useSidebarBadges() {
  const { data: ticketData } = useQuery<{ items: unknown[]; total: number }>({
    queryKey: ['admin', 'support-tickets', 'open-count'],
    queryFn: () => get('/admin/support-tickets?status=open&limit=1'),
    staleTime: 30_000,
  });
  return { openTickets: ticketData?.total ?? 0 };
}

// SVG icon components
const Icons = {
  Dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h2.5A2.25 2.25 0 019 4.25v2.5A2.25 2.25 0 016.75 9h-2.5A2.25 2.25 0 012 6.75v-2.5zm8 0A2.25 2.25 0 0112.25 2h2.5A2.25 2.25 0 0117 4.25v2.5A2.25 2.25 0 0114.75 9h-2.5A2.25 2.25 0 0110 6.75v-2.5zm-8 8A2.25 2.25 0 014.25 10h2.5A2.25 2.25 0 019 12.25v2.5A2.25 2.25 0 016.75 17h-2.5A2.25 2.25 0 012 14.75v-2.5zm8 0A2.25 2.25 0 0112.25 10h2.5A2.25 2.25 0 0117 12.25v2.5A2.25 2.25 0 0114.75 17h-2.5A2.25 2.25 0 0110 14.75v-2.5z" clipRule="evenodd" />
    </svg>
  ),
  Vendors: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h10.5a.75.75 0 010 1.5H12v13.75a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-2.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v2.5a.75.75 0 01-.75.75H3.75A.75.75 0 013 17.25V3.5h-.25A.75.75 0 011 2.75zM4 5.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zM4.5 9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1zM8 5.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zM8.5 9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1zM14.25 6a.75.75 0 00-.75.75V17.25h-.75a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H16.5v-8.5h.75a.75.75 0 000-1.5h-3zm.5 3.5a.5.5 0 01.5-.5h.5a.5.5 0 01.5.5v.5a.5.5 0 01-.5.5h-.5a.5.5 0 01-.5-.5v-.5zm.5 2.5a.5.5 0 00-.5.5v.5a.5.5 0 00.5.5h.5a.5.5 0 00.5-.5v-.5a.5.5 0 00-.5-.5h-.5z" clipRule="evenodd" />
    </svg>
  ),
  Catalog: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  ),
  Finance: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M1 4a1 1 0 011-1h16a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4zm12 4a3 3 0 11-6 0 3 3 0 016 0zM4 9a1 1 0 100-2 1 1 0 000 2zm13-1a1 1 0 11-2 0 1 1 0 012 0zM1.75 14.5a.75.75 0 000 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 00-1.5 0v.784a.272.272 0 01-.35.25A49.043 49.043 0 001.75 14.5z" clipRule="evenodd" />
    </svg>
  ),
  Orders: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M3.105 2.289a.75.75 0 00-.67.943l1.519 5.683a3.001 3.001 0 001.677 1.952l1.526.678-.854 1.952a1.5 1.5 0 00.267 1.621l2.21 2.468a.75.75 0 001.117-1.001l-2.21-2.468a.001.001 0 01-.001-.001l.853-1.95A3 3 0 009.5 10H6a1.5 1.5 0 01-1.448-1.107L3.105 2.289zM15 2a.75.75 0 01.75.75v10.5a.75.75 0 01-1.5 0V2.75A.75.75 0 0115 2zM15 15.25a1 1 0 100 2 1 1 0 000-2z" />
    </svg>
  ),
  Insights: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 003 0v-13A1.5 1.5 0 0015.5 2zM9.5 6A1.5 1.5 0 008 7.5v9a1.5 1.5 0 003 0v-9A1.5 1.5 0 009.5 6zM3.5 10A1.5 1.5 0 002 11.5v5a1.5 1.5 0 003 0v-5A1.5 1.5 0 003.5 10z" />
    </svg>
  ),
  Support: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-1.5 0a6.5 6.5 0 11-11-4.69v.447a3.5 3.5 0 001.025 2.475L8.293 10 8 10.293a1 1 0 000 1.414l1.5 1.5a1 1 0 001.414-1.414l-.293-.293.707-.707A1 1 0 0011 10V9h1a1 1 0 100-2h-1a3 3 0 00-2.554 1.43L7.28 8.85a2 2 0 01-.28-.35 5 5 0 019 3.2v.3h-1v-.3a4 4 0 00-.483-1.9L13 10.5V13a.75.75 0 001.5 0V10a6.48 6.48 0 00-2-4.69z" clipRule="evenodd" />
    </svg>
  ),
  Cms: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0-6a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
    </svg>
  ),
  Flags: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M3.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0v-4.392l1.657-.348a6.449 6.449 0 014.271.572 7.948 7.948 0 005.965.524l2.078-.64A.75.75 0 0018 12.25v-8.5a.75.75 0 00-.904-.734l-2.38.501a7.25 7.25 0 01-4.186-.363l-.502-.2a8.75 8.75 0 00-5.053-.439l-1.475.31V2.75z" />
    </svg>
  ),
  Settings: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
  Audit: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z" clipRule="evenodd" />
    </svg>
  ),
  Categories: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  Logout: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
    </svg>
  ),
};

const mainNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
  { to: '/vendors', label: 'Vendors', icon: Icons.Vendors, roles: ['super_admin', 'moderator'] },
  { to: '/catalog-moderation', label: 'Catalog', icon: Icons.Catalog, roles: ['super_admin', 'moderator'] },
  { to: '/finance', label: 'Finance', icon: Icons.Finance, roles: ['super_admin', 'finance_admin'] },
  { to: '/orders', label: 'Orders', icon: Icons.Orders, roles: ['super_admin', 'moderator'] },
  { to: '/insights', label: 'Insights', icon: Icons.Insights, roles: ['super_admin', 'finance_admin'] },
  { to: '/support', label: 'Support', icon: Icons.Support, roles: ['super_admin', 'moderator'] },
  { to: '/cms', label: 'CMS', icon: Icons.Cms, roles: ['super_admin', 'moderator'] },
  { to: '/feature-flags', label: 'Feature Flags', icon: Icons.Flags, roles: ['super_admin', 'moderator'] },
  { to: '/settings', label: 'Settings', icon: Icons.Settings, roles: ['super_admin'] },
  { to: '/audit-log', label: 'Audit Log', icon: Icons.Audit, roles: ['super_admin'] },
];

const categoryNavItems: NavItem[] = [
  { to: '/categories', label: 'Categories', icon: Icons.Categories },
];

function NavItemComponent({ item, badge }: { item: NavItem; badge?: number }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          'group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-150',
          isActive
            ? 'bg-[#4f7ef8]/10 text-[#7aa4fb]'
            : 'text-[#4a5980] hover:bg-[#0f1629] hover:text-[#8a9bbf]',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[#4f7ef8]" />
          )}
          <span className="flex items-center gap-2.5">
            <span className={isActive ? 'text-[#4f7ef8]' : 'text-[#3a4a6a] group-hover:text-[#5b6b9a]'}>
              {item.icon}
            </span>
            <span className="font-['Syne'] text-[13px] font-medium">{item.label}</span>
          </span>
          {badge != null && badge > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#4f7ef8]/20 px-1 font-['DM_Mono'] text-[10px] font-medium text-[#4f7ef8]">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { openTickets } = useSidebarBadges();
  const role = admin?.role ?? 'moderator';

  function handleLogout() {
    logout(undefined, {
      onSettled: () => navigate('/auth/login', { replace: true }),
    });
  }

  const visibleNavItems = mainNavItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  return (
    <motion.aside
      className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-[#111827] bg-[#060a14]"
      initial={{ x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-[#111827] px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4f7ef8] shadow-[0_0_16px_rgba(79,126,248,0.35)]">
          <span className="font-['Syne'] text-sm font-bold text-white">G</span>
        </div>
        <div>
          <span className="font-['Syne'] text-sm font-bold text-white">Grovio</span>
          <p className="font-['Syne'] text-[10px] font-medium uppercase tracking-widest text-[#2a3a5a]">Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {visibleNavItems.map((item) => (
            <NavItemComponent
              key={item.to}
              item={item}
              {...(item.to === '/support' && openTickets > 0 ? { badge: openTickets } : {})}
            />
          ))}
        </div>

        {/* Catalog structure group */}
        <div className="my-3 border-t border-[#111827]" />
        <p className="mb-2 px-3 font-['Syne'] text-[9px] font-semibold uppercase tracking-[0.2em] text-[#2a3a5a]">
          Catalog Structure
        </p>
        <div className="space-y-0.5">
          {categoryNavItems.map((item) => (
            <NavItemComponent key={item.to} item={item} />
          ))}
        </div>
      </nav>

      {/* Admin profile + logout */}
      <div className="border-t border-[#111827] px-2 py-3">
        {admin && (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#4f7ef8]/20 font-['DM_Mono'] text-[11px] font-bold text-[#4f7ef8]">
              {admin.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-['Syne'] text-[11px] font-medium text-[#6a7fa8]">
                {admin.email}
              </p>
              <p className="font-['Syne'] text-[9px] font-semibold uppercase tracking-widest text-[#2a3a5a]">
                {admin.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[#2a3a5a] transition-colors hover:bg-[#0f1629] hover:text-[#f87171]"
        >
          {Icons.Logout}
          <span className="font-['Syne'] text-[13px] font-medium">Sign out</span>
        </button>
      </div>
    </motion.aside>
  );
}
