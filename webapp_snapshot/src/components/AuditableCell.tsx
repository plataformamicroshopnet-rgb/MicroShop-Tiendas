'use client'

import React from 'react';
import { useAuditMode } from '@/hooks/useAuditMode';
import { Info } from 'lucide-react';

interface AuditableCellProps {
    metricKey: string;
    data?: any;
    children: React.ReactNode;
}

export function AuditableCell({ metricKey, data, children }: AuditableCellProps) {
    const { isAuditMode, selectMetric, selectedMetric } = useAuditMode();

    if (!isAuditMode) {
        return <>{children}</>;
    }

    const isSelected = selectedMetric?.key === metricKey;

    return (
        <div 
            onClick={(e) => {
                e.stopPropagation();
                selectMetric(metricKey, data);
            }}
            style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                border: isSelected ? '1px solid #3b82f6' : '1px dashed #94a3b8',
                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(241, 245, 249, 0.5)',
                transition: 'all 0.2s',
                width: '100%',
                justifyContent: 'center'
            }}
            title="Clic para ver trazabilidad"
        >
            {children}
            <Info size={14} color={isSelected ? '#3b82f6' : '#94a3b8'} style={{ flexShrink: 0 }} />
        </div>
    );
}
