import { memo, useMemo, useRef, useState, useCallback } from 'react';
import type { Country } from '../../types';
import { CountryCard } from '../country-card/country-card';
import { getPopulationForYear, createYearDataMap } from '../../utils/data-transformers';

import styles from './country-list.module.css';

const ITEM_HEIGHT = 340;
const LIST_HEIGHT = 620;
const OVERSCAN = 3;

type CountryListProps = {
  countries: Country[];
  searchQuery: string;
  selectedColumns: string[];
  selectedRegion: string;
  selectedYear: number;
  sortField: 'name' | 'population';
  sortOrder: 'asc' | 'desc';
  onYearChange: (year: number) => void;
};

export const CountryList = memo(({
  countries,
  searchQuery,
  selectedColumns,
  selectedRegion,
  selectedYear,
  sortField,
  sortOrder,
}: CountryListProps) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredCountries = useMemo(() => {
    const filtered = countries.filter((c) => {
      const matchesSearch = c.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRegion = !selectedRegion || c.data.some((d) => d.region === selectedRegion);
      return matchesSearch && matchesRegion;
    });

    if (sortField === 'name') {
      return filtered.sort((a, b) =>
        sortOrder === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id),
      );
    }

    // Pre-compute population per country once — avoids calling createYearDataMap
    // inside the sort comparator (which would be O(n log n) map allocations)
    const withPop = filtered.map((c) => ({
      country: c,
      pop: getPopulationForYear(createYearDataMap(c.data), selectedYear) ?? 0,
    }));

    return withPop
      .sort((a, b) => (sortOrder === 'asc' ? a.pop - b.pop : b.pop - a.pop))
      .map((x) => x.country);
  }, [countries, searchQuery, selectedRegion, selectedYear, sortField, sortOrder]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = filteredCountries.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    filteredCountries.length - 1,
    Math.ceil((scrollTop + LIST_HEIGHT) / ITEM_HEIGHT) + OVERSCAN,
  );

  const visibleItems = filteredCountries.slice(startIndex, endIndex + 1);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: LIST_HEIGHT, overflowY: 'auto', position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((country, i) => (
          <div
            key={country.id}
            style={{
              position: 'absolute',
              top: (startIndex + i) * ITEM_HEIGHT,
              width: '100%',
              height: ITEM_HEIGHT,
            }}
          >
            <CountryCard
              country={country}
              selectedYear={selectedYear}
              selectedColumns={selectedColumns}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
