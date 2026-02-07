import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN_URL || 'https://batasnatin.com';

const UserMenu: React.FC = () => {
  const { user, profile, signOut, signInWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        <User size={14} />
        Sign In
      </button>
    );
  }

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url;
  const tier = profile?.tier || 'free';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
        aria-label="User menu"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-accent-muted flex items-center justify-center">
            <User size={14} className="text-accent" />
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-bg-secondary border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-accent-muted flex items-center justify-center">
                  <User size={18} className="text-accent" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{displayName}</p>
                <p className="text-xs text-text-tertiary truncate">{user.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-accent-muted text-accent uppercase">
                  {tier}
                </span>
              </div>
            </div>
          </div>

          <div className="p-2">
            <a
              href={`${MAIN_DOMAIN}/account`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors w-full"
              onClick={() => setOpen(false)}
            >
              <ExternalLink size={16} />
              Manage Account
            </a>
            <button
              onClick={() => { signOut(); setOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-muted rounded-lg transition-colors w-full text-left"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
