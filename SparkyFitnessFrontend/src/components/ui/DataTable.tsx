import { useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  RowSelectionState,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DataTablePagination } from './DataTablePagination';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount?: number;
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
  onSortingChange?: (sorting: SortingState) => void;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  onRowDoubleClick?: (row: TData) => void;
  manualPagination?: boolean;
  manualSorting?: boolean;
  /** Current selection state (controlled) */
  rowSelection?: RowSelectionState;
  /** Current sorting state (controlled) */
  sorting?: SortingState;
  /** Current pagination state (controlled) */
  pagination?: {
    pageIndex: number;
    pageSize: number;
  };
  /** @deprecated Use rowSelection, sorting, pagination props directly */
  initialState?: {
    pagination?: {
      pageIndex: number;
      pageSize: number;
    };
    sorting?: SortingState;
    rowSelection?: RowSelectionState;
  };
  isLoading?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  /** Identifies which column to show as the title in mobile cards */
  titleColumnId?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  onPaginationChange,
  onSortingChange,
  onRowSelectionChange,
  onRowDoubleClick,
  manualPagination = false,
  manualSorting = false,
  rowSelection: externalRowSelection,
  sorting: externalSorting,
  pagination: externalPagination,
  initialState,
  isLoading,
  searchPlaceholder,
  onSearchChange,
  titleColumnId,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>(
    initialState?.sorting || []
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>(initialState?.rowSelection || {});
  const [internalPagination, setInternalPagination] = useState(
    initialState?.pagination || {
      pageIndex: 0,
      pageSize: 10,
    }
  );

  const rowSelection = externalRowSelection ?? internalRowSelection;
  const sorting = externalSorting ?? internalSorting;
  const pagination = externalPagination ?? internalPagination;

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      if (externalSorting === undefined) setInternalSorting(next);
      onSortingChange?.(next);
    },
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(rowSelection) : updater;
      if (externalRowSelection === undefined) setInternalRowSelection(next);
      onRowSelectionChange?.(next);
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(pagination) : updater;
      if (externalPagination === undefined) setInternalPagination(next);
      onPaginationChange?.(next.pageIndex, next.pageSize);
    },
    manualPagination,
    manualSorting,
    pageCount: pageCount,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      pagination,
    },
  });

  return (
    <div className="space-y-4">
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder={searchPlaceholder || 'Search...'}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-10 max-w-sm"
          />
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.id === 'actions' && 'text-right',
                        canSort && 'cursor-pointer select-none'
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div
                        className={cn(
                          'flex items-center gap-2',
                          header.column.id === 'actions' && 'justify-end'
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {canSort && (
                          <div className="shrink-0">
                            {{
                              asc: <ArrowUp className="h-3 w-3" />,
                              desc: <ArrowDown className="h-3 w-3" />,
                            }[header.column.getIsSorted() as string] ?? (
                              <ArrowUpDown className="h-3 w-3 opacity-50" />
                            )}
                          </div>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onDoubleClick={() => onRowDoubleClick?.(row.original)}
                  className={cn(
                    onRowDoubleClick &&
                      'cursor-pointer select-none transition-colors hover:bg-muted/50'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.id === 'actions' && 'text-right',
                        cell.column.id === 'select' && 'w-[40px]'
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Row View */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground italic border-2 border-dashed rounded-2xl bg-gray-50/50 dark:bg-gray-900/20">
            Loading...
          </div>
        ) : table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <Card
              key={row.id}
              onDoubleClick={() => onRowDoubleClick?.(row.original)}
              className={`transition-all duration-200 border-2 overflow-hidden shadow-sm ${
                row.getIsSelected()
                  ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
                  : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
              } ${onRowDoubleClick ? 'active:scale-[0.98]' : ''}`}
            >
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {(() => {
                      const selectCell = row
                        .getVisibleCells()
                        .find((c) => c.column.id === 'select');
                      return selectCell
                        ? flexRender(
                            selectCell.column.columnDef.cell,
                            selectCell.getContext()
                          )
                        : null;
                    })()}

                    <div
                      className="truncate font-bold text-gray-900 dark:text-gray-100 text-sm flex-1"
                      onClick={() => onRowDoubleClick?.(row.original)}
                    >
                      {(() => {
                        const targetId =
                          titleColumnId ||
                          (row
                            .getVisibleCells()
                            .find((c) => c.column.id === 'name')
                            ? 'name'
                            : row
                                  .getVisibleCells()
                                  .find((c) => c.column.id === 'plan_name')
                              ? 'plan_name'
                              : null);

                        const titleCell = targetId
                          ? row
                              .getVisibleCells()
                              .find((c) => c.column.id === targetId)
                          : row
                              .getVisibleCells()
                              .find(
                                (c) =>
                                  c.column.id !== 'select' &&
                                  c.column.id !== 'actions'
                              );

                        return titleCell
                          ? flexRender(
                              titleCell.column.columnDef.cell,
                              titleCell.getContext()
                            )
                          : 'Item';
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {(() => {
                      const actionsCell = row
                        .getVisibleCells()
                        .find((c) => c.column.id === 'actions');
                      return actionsCell
                        ? flexRender(
                            actionsCell.column.columnDef.cell,
                            actionsCell.getContext()
                          )
                        : null;
                    })()}
                  </div>
                </div>

                <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                  {row.getVisibleCells().map((cell) => {
                    const isHiddenOnMobile = (
                      cell.column.columnDef as ColumnDef<TData, TValue> & {
                        meta?: { hideOnMobile?: boolean };
                      }
                    ).meta?.hideOnMobile;

                    const targetTitleId =
                      titleColumnId ||
                      (row.getVisibleCells().find((c) => c.column.id === 'name')
                        ? 'name'
                        : row
                              .getVisibleCells()
                              .find((c) => c.column.id === 'plan_name')
                          ? 'plan_name'
                          : null);

                    const titleCellId =
                      targetTitleId ||
                      row
                        .getVisibleCells()
                        .find(
                          (c) =>
                            c.column.id !== 'select' &&
                            c.column.id !== 'actions'
                        )?.column.id;

                    if (
                      cell.column.id === 'select' ||
                      cell.column.id === 'actions' ||
                      cell.column.id === titleCellId ||
                      isHiddenOnMobile
                    )
                      return null;

                    const header = cell.column.columnDef.header;
                    const tableHeader = table
                      .getHeaderGroups()
                      .flatMap((g) => g.headers)
                      .find((h) => h.column.id === cell.column.id);

                    return (
                      <div key={cell.id} className="flex flex-col gap-0.5">
                        <span className="text-[9px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-tighter truncate">
                          {tableHeader
                            ? flexRender(header, tableHeader.getContext())
                            : typeof header === 'string'
                              ? header
                              : cell.column.id}
                        </span>
                        <div className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="p-12 text-center text-muted-foreground italic border-2 border-dashed rounded-2xl bg-gray-50/50 dark:bg-gray-900/20">
            No results found.
          </div>
        )}
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}
