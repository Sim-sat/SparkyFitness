// hooks/Exercises/useExerciseFilters.ts
import { useState, useEffect } from 'react';
import type { ExerciseOwnershipFilter } from '@/types/exercises';

export function useExerciseFilters() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] =
    useState<ExerciseOwnershipFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, ownershipFilter, itemsPerPage]);

  return {
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    ownershipFilter,
    setOwnershipFilter,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
  };
}
