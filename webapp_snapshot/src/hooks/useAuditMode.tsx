'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MetricLineage, getLineage } from '@/lib/dataLineage';

interface AuditContextType {
    isAuditMode: boolean;
    setAuditMode: (active: boolean) => void;
    selectedMetric: MetricLineage | null;
    selectMetric: (key: string | null) => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
    const [isAuditMode, setAuditMode] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<MetricLineage | null>(null);

    const selectMetric = (key: string | null) => {
        if (!key) {
            setSelectedMetric(null);
            return;
        }
        const lineage = getLineage(key);
        if (lineage) {
            setSelectedMetric(lineage);
        } else {
            console.warn(`Metric lineage not found for key: ${key}`);
            setSelectedMetric(null);
        }
    };

    return (
        <AuditContext.Provider value={{ isAuditMode, setAuditMode, selectedMetric, selectMetric }}>
            {children}
        </AuditContext.Provider>
    );
}

export function useAuditMode() {
    const context = useContext(AuditContext);
    if (context === undefined) {
        throw new Error('useAuditMode must be used within an AuditProvider');
    }
    return context;
}
