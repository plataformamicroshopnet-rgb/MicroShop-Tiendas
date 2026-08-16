'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Info } from 'lucide-react'
import { PeriodSelector } from '@/components/PeriodSelector'
import { ThemeToggle } from '@/components/ThemeToggle'


export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  showBack?: boolean;
  showTheme?: boolean;
  backFallback?: string;
  onBack?: () => void;
  headerActions?: React.ReactNode;
  helpContent?: React.ReactNode;
  showPeriodSelector?: boolean;
}

export function PageHeader({ 
  title, 
  subtitle, 
  showBack = false, 
  showTheme = false,
  backFallback = '/',
  onBack,
  headerActions,
  helpContent,
  showPeriodSelector = true
}: PageHeaderProps) {
  const router = useRouter();
  // El tema ya no se lee aquí: se lo guisa entero el propio ThemeToggle.
  const [showHelp, setShowHelp] = React.useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      router.back();
    } else {
      router.push(backFallback);
    }
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: 40, 
    height: 40, 
    borderRadius: '50%', 
    background: 'rgba(255,255,255,0.05)', 
    border: '1px solid var(--border-color)', 
    color: 'var(--light-text)', 
    cursor: 'pointer', 
    transition: 'all 0.2s',
    flexShrink: 0
  };

  return (
    <div className="page-header-bar" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center', // Align everything on a single line
      marginBottom: 24,
      gap: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
        {showBack && (
          <button 
            type="button"
            onClick={handleBack} 
            title="Volver"
            style={buttonStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 10 }}>
              {title}
            </h1>
            {helpContent && (
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'help' }}
                onMouseEnter={() => setShowHelp(true)}
                onMouseLeave={() => setShowHelp(false)}
              >
                <Info size={18} color="var(--mercedes-cyan)" />
                {showHelp && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 8,
                    width: 380,
                    background: 'var(--bg-card)', // Fixed CSS variable name
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: 16,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    zIndex: 1000,
                    fontSize: 13,
                    color: 'var(--light-text)',
                    lineHeight: 1.5,
                    whiteSpace: 'normal'
                  }}>
                    {helpContent}
                  </div>
                )}
              </div>
            )}
          </div>
          {subtitle && (
            <p style={{ color: 'var(--medium-gray)', margin: '4px 0 0 0', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {showTheme && <ThemeToggle />}
          {headerActions}
          {showPeriodSelector && <PeriodSelector />}
        </div>
    </div>
  );
}
