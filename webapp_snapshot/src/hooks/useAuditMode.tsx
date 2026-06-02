'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MetricLineage, getLineage } from '@/lib/dataLineage';

interface AuditContextType {
    isAuditMode: boolean;
    setAuditMode: (active: boolean) => void;
    selectedMetric: MetricLineage | null;
    selectedMetricData: any;
    selectMetric: (key: string | null, data?: any) => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
    const [isAuditMode, setAuditMode] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<MetricLineage | null>(null);
    const [selectedMetricData, setSelectedMetricData] = useState<any>(null);

    const selectMetric = (key: string | null, data?: any) => {
        if (!key) {
            setSelectedMetric(null);
            setSelectedMetricData(null);
            return;
        }
        const lineage = getLineage(key);
        if (lineage) {
            setSelectedMetric(lineage);
            setSelectedMetricData(data || null);
        } else {
            console.warn(`Metric lineage not found for key: ${key}`);
            setSelectedMetric(null);
            setSelectedMetricData(null);
        }
    };

    return (
        <AuditContext.Provider value={{ isAuditMode, setAuditMode, selectedMetric, selectedMetricData, selectMetric }}>
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
