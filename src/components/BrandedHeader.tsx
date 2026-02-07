import React, { useState } from 'react';
import { Scale, Menu, X } from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';
import UserMenu from './UserMenu';

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN_URL || 'https://batasnatin.com';

const BrandedHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-bg-secondary border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left - Logo & Nav */}
        <div className="flex items-center gap-6">
          <a href={MAIN_DOMAIN} className="flex items-center gap-2 text-text-primary hover:opacity-80 transition-opacity">
            <Scale size={24} className="text-accent" />
            <span className="font-bold text-lg">BATASnatin</span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4">
            <a
              href={MAIN_DOMAIN}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Home
            </a>
            <span className="text-sm font-medium text-accent">
              Docs Chat
            </span>
          </nav>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <UserMenu />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileMenuOpen && (
        <nav className="md:hidden mt-3 pt-3 border-t border-border flex flex-col gap-2">
          <a
            href={MAIN_DOMAIN}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors py-2"
          >
            Home
          </a>
          <span className="text-sm font-medium text-accent py-2">
            Docs Chat
          </span>
        </nav>
      )}
    </header>
  );
};

export default BrandedHeader;
