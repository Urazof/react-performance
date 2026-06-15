import { memo, useMemo } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import type { Country } from '../../types';
import { CountryCard } from '../country-card/country-card';
import { getPopulationForYear, createYearDataMap } from '../../utils/data-transformers';

import styles from './country-list.module.css';

const ITEM_HEIGHT = 340;
const LIST_HEIGHT = 620;

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

  const itemData = useMemo(
    () => ({ countries: filteredCountries, selectedYear, selectedColumns }),
    [filteredCountries, selectedYear, selectedColumns],
  );

  return (
    <FixedSizeList
      height={LIST_HEIGHT}
      itemCount={filteredCountries.length}
      itemSize={ITEM_HEIGHT}
      width="100%"
      itemData={itemData}
      className={styles.countryList}
    >
      {Row}
    </FixedSizeList>
  );
});

type RowData = { countries: Country[]; selectedYear: number; selectedColumns: string[] };

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const { countries, selectedYear, selectedColumns } = data;
  return (
    <div style={style}>
      <CountryCard
        country={countries[index]}
        selectedYear={selectedYear}
        selectedColumns={selectedColumns}
      />
    </div>
  );
}
