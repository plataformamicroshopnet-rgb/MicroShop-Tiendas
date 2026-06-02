'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Sun, Moon, ArrowLeft, Info, Eye, EyeOff } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { PeriodSelector } from '@/components/PeriodSelector'
import { useAuditMode } from '@/hooks/useAuditMode'


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
  const { theme, toggleTheme } = useTheme();
  const { isAuditMode, setAuditMode } = useAuditMode();
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
    <div style={{ 
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
          {showTheme && (
            <button 
              type="button"
              onClick={toggleTheme} 
              title={theme === 'dark' ? 'Cambiar a Modo Día' : 'Cambiar a Modo Noche'}
              style={buttonStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              {theme === 'dark' ? <Sun size={20} color="#FF9500" /> : <Moon size={20} color="#00ADEF" />}
            </button>
          )}
          <button 
            type="button"
            onClick={() => setAuditMode(!isAuditMode)} 
            title={isAuditMode ? 'Desactivar Modo Auditoría' : 'Activar Modo Auditoría (Trazabilidad)'}
            style={{
              ...buttonStyle,
              background: isAuditMode ? 'rgba(59, 130, 246, 0.1)' : buttonStyle.background,
              borderColor: isAuditMode ? '#3b82f6' : 'var(--border-color)',
              color: isAuditMode ? '#3b82f6' : buttonStyle.color
            }}
            onMouseEnter={e => e.currentTarget.style.background = isAuditMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = isAuditMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)'}
          >
            {isAuditMode ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
          {headerActions}
          {showPeriodSelector && <PeriodSelector />}
        </div>
    </div>
  );
}
