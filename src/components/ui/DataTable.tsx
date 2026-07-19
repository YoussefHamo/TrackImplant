import {
  type ReactNode,
  useCallback,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Skeleton } from './Skeleton';
import EmptyState from './EmptyState';

/* ─── Types ─── */

export interface Column<T> {
  /** Unique key for the column (used for sorting). */
  key: string;
  /** Header label displayed in the table head. */
  header: string;
  /** Whether the column is sortable. */
  sortable?: boolean;
  /** Custom render function. Falls back to rendering `String(item[key as keyof T])`. */
  render?: (item: T) => ReactNode;
  /** Additional class name for every cell in this column. */
  className?: string;
  /** Fixed or percentage width (e.g. '120px', '15%'). */
  width?: string;
  /** Hint to render content in monospaced font (ideal for IDs, prices, numbers). */
  mono?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  /** Optional error banner above the table. */
  error?: string | null;
  /** Called when the retry button in the error banner is clicked. */
  onRetry?: () => void;
  /** Called when a row is clicked or activated via keyboard. */
  onRowClick?: (item: T) => void;
  /** Current sort key (column key). */
  sortKey?: string;
  /** Current sort direction. */
  sortOrder?: 'asc' | 'desc';
  /** Called when a sortable column header is clicked. */
  onSort?: (key: string) => void;
  /** Number of items per page. */
  pageSize?: number;
  /** Current page (1-indexed). */
  currentPage?: number;
  /** Total number of items across all pages. */
  totalItems?: number;
  /** Called when the page changes. */
  onPageChange?: (page: number) => void;
}

/* ─── Sort Icon ─── */

function SortIcon({
  columnKey,
  sortKey,
  sortOrder,
}: {
  columnKey: string;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const isActive = sortKey === columnKey;

  if (!isActive) {
    return (
      <ArrowUpDown
        className="w-3 h-3 ml-1.5 shrink-0"
        style={{ color: 'rgba(255,255,255,0.2)' }}
        aria-hidden="true"
      />
    );
  }

  return sortOrder === 'asc' ? (
    <ArrowUp
      className="w-3 h-3 ml-1.5 shrink-0 text-cyan-400"
      aria-hidden="true"
    />
  ) : (
    <ArrowDown
      className="w-3 h-3 ml-1.5 shrink-0 text-cyan-400"
      aria-hidden="true"
    />
  );
}

/* ─── Loading Skeleton Rows ─── */

function LoadingRows({ columns, rowCount = 5 }: { columns: Column<unknown>[]; rowCount?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rowCount }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-3 px-3 py-3 border-b"
          style={{ borderColor: 'var(--app-border)' }}
        >
          {columns.map((col, colIdx) => (
            <div
              key={colIdx}
              className="flex-1 min-w-0"
              style={{ width: col.width ?? `${100 / columns.length}%` }}
            >
              <Skeleton className="h-3.5 rounded-md" style={{ width: `${40 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Header Row ─── */

function HeaderRow<T>({
  columns,
  sortKey,
  sortOrder,
  onSort,
}: {
  columns: Column<T>[];
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}) {
  return (
    <div
      className="flex items-stretch"
      style={{
        background: 'var(--app-surface)',
        borderBottom: '1px solid var(--app-border-light)',
      }}
    >
      {columns.map((col) => {
        const isSortable = col.sortable && onSort;
        const isActive = sortKey === col.key;
        const ariaSort =
          isActive && sortOrder === 'asc'
            ? ('ascending' as const)
            : isActive && sortOrder === 'desc'
              ? ('descending' as const)
              : ('none' as const);

        return (
          <div
            key={col.key}
            aria-sort={isSortable ? ariaSort : undefined}
            className="flex items-center gap-0.5 px-3 py-3 text-[11px] font-bold uppercase tracking-wider select-none"
            style={{
              width: col.width ?? `${100 / columns.length}%`,
              color: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.35)',
              cursor: isSortable ? 'pointer' : 'default',
              transition: 'color 200ms var(--ease-out-expo)',
            }}
            onClick={() => {
              if (isSortable) onSort(col.key);
            }}
            onKeyDown={(e: ReactKeyboardEvent) => {
              if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSort(col.key);
              }
            }}
            tabIndex={isSortable ? 0 : undefined}
            aria-label={
              isSortable
                ? `Sort by ${col.header}${
                    isActive && sortOrder === 'asc'
                      ? ', ascending'
                      : isActive && sortOrder === 'desc'
                        ? ', descending'
                        : ''
                  }`
                : undefined
            }
            role={isSortable ? 'button' : 'columnheader'}
          >
            <span className="truncate">{col.header}</span>
            {isSortable && (
              <SortIcon columnKey={col.key} sortKey={sortKey} sortOrder={sortOrder} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Body Row ─── */

function BodyRow<T>({
  item,
  columns,
  rowIndex,
  onRowClick,
  keyExtractor,
}: {
  item: T;
  columns: Column<T>[];
  rowIndex: number;
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string;
}) {
  const isEven = rowIndex % 2 === 1;

  const handleClick = useCallback(() => {
    onRowClick?.(item);
  }, [onRowClick, item]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
        e.preventDefault();
        onRowClick(item);
      }
    },
    [onRowClick, item],
  );

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 1}
      className="flex items-stretch transition-all duration-200"
      style={{
        borderBottom: '1px solid var(--app-border)',
        background: isEven ? 'var(--app-table-hover)' : 'transparent',
        cursor: onRowClick ? 'pointer' : 'default',
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onRowClick ? 0 : undefined}
      data-row-key={keyExtractor(item)}
    >
      {columns.map((col) => {
        const cellContent = col.render ? col.render(item) : String(item[col.key as keyof T] ?? '');

        return (
          <div
            key={col.key}
            role="cell"
            className={`px-3 py-3 text-xs truncate ${col.mono ? 'font-mono tracking-tight' : ''} ${col.className ?? ''}`}
            style={{
              width: col.width ?? `${100 / columns.length}%`,
              color: col.render ? undefined : 'rgba(255,255,255,0.65)',
            }}
          >
            {cellContent}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Pagination ─── */

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalItems, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const pageNumbers = useMemo(() => {
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // sliding window centred around currentPage
    const half = Math.floor(maxVisible / 2);
    let start = currentPage - half;
    let end = currentPage + half;

    if (start < 1) {
      start = 1;
      end = Math.min(maxVisible, totalPages);
    }
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, totalPages - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  const showingStart = (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderTop: '1px solid var(--app-border)' }}
      role="navigation"
      aria-label="Pagination"
    >
      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Showing {showingStart}–{showingEnd} of {totalItems}
      </span>

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-20"
          style={{
            color: 'rgba(255,255,255,0.45)',
            border: '1px solid var(--app-border)',
          }}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((n) => {
          const isActive = n === currentPage;
          return (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className="w-7 h-7 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: isActive ? 'rgba(79,209,255,0.12)' : 'transparent',
                border: isActive
                  ? '1px solid rgba(79,209,255,0.25)'
                  : '1px solid transparent',
                color: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.4)',
              }}
              aria-label={`Page ${n}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {n}
            </button>
          );
        })}

        {/* Next */}
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-20"
          style={{
            color: 'rgba(255,255,255,0.45)',
            border: '1px solid var(--app-border)',
          }}
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = 'No records found',
  emptyDescription,
  error = null,
  onRetry,
  onRowClick,
  sortKey,
  sortOrder,
  onSort,
  pageSize = 0,
  currentPage = 1,
  totalItems,
  onPageChange,
}: DataTableProps<T>) {
  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const safeTotalItems = totalItems ?? safeData.length;

  /* ── Loading State ── */
  if (loading) {
    return (
      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: 'var(--app-card-bg)',
          border: '1px solid var(--app-card-border)',
        }}
        role="status"
        aria-label="Loading data"
      >
        <HeaderRow columns={columns as Column<unknown>[]} sortKey={sortKey} sortOrder={sortOrder} onSort={onSort as (key: string) => void} />
        <LoadingRows columns={columns as Column<unknown>[]} rowCount={5} />
      </div>
    );
  }

  /* ── Error State ── */
  if (error) {
    return (
      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: 'var(--app-card-bg)',
          border: '1px solid var(--app-card-border)',
        }}
      >
        <div className="flex flex-col items-center justify-center py-16 px-4" role="alert">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(244,63,94,0.1)' }}
          >
            <AlertCircle className="w-7 h-7" style={{ color: 'var(--color-error)' }} />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Something went wrong
          </h3>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn-secondary btn-sm inline-flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Empty State ── */
  if (safeData.length === 0) {
    return (
      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: 'var(--app-card-bg)',
          border: '1px solid var(--app-card-border)',
        }}
      >
        <HeaderRow columns={columns as Column<unknown>[]} sortKey={sortKey} sortOrder={sortOrder} onSort={onSort as (key: string) => void} />
        <div role="status">
          <EmptyState
            title={emptyMessage}
            description={emptyDescription}
          />
        </div>
      </div>
    );
  }

  /* ── Data Rows ── */
  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        background: 'var(--app-card-bg)',
        border: '1px solid var(--app-card-border)',
      }}
    >
      {/* Horizontally scrollable table container */}
      <div className="overflow-x-auto">
        <div role="table" aria-label="Data table" className="min-w-full">
          {/* Header */}
          <HeaderRow columns={columns} sortKey={sortKey} sortOrder={sortOrder} onSort={onSort} />

          {/* Body */}
          <div role="rowgroup">
            {safeData.map((item, index) => (
              <BodyRow
                key={keyExtractor(item)}
                item={item}
                columns={columns}
                rowIndex={index}
                onRowClick={onRowClick}
                keyExtractor={keyExtractor}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {pageSize > 0 && safeTotalItems > pageSize && onPageChange && (
        <Pagination
          currentPage={currentPage}
          totalItems={safeTotalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
