import { useEffect, useRef } from 'react';
import { fetchSalesForMonths } from '../lib/dataService';

export const useSalesData = (year: number | 'all', months: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], updateTrigger: number = 0, onUpdate?: () => void) => {
    const monthsKey = months.join(',');
    const onUpdateRef = useRef(onUpdate);
    
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    });
    
    useEffect(() => {
        const stableOnUpdate = () => {
            if (onUpdateRef.current) onUpdateRef.current();
        };

        if (typeof year === 'number') {
            // Buscar meses selecionados para o ano atual
            fetchSalesForMonths(year, months, stableOnUpdate);
            
            // Para cálculos de crescimento (YoY), precisamos dos mesmos meses do ano anterior
            fetchSalesForMonths(year - 1, months, stableOnUpdate);
        } else if (year === 'all') {
            const currentYear = new Date().getFullYear();
            fetchSalesForMonths(currentYear, months, stableOnUpdate);
            fetchSalesForMonths(currentYear - 1, months, stableOnUpdate);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, monthsKey, updateTrigger]);
};
