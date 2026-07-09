import { type ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import EmptyState from './EmptyState';

interface Column<T> {
  header: string;
  render: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
}

const Row = <T,>({ item, columns }: { item: T; columns: Column<T>[] }) => {
  if (!item) return null;

  return (
    <div className="flex border-b border-[#222630] items-center hover:bg-[#1c2027]/40 transition-colors">
      {columns.map((col, colIndex) => (
        <div
          key={colIndex}
          className="px-4 text-xs text-gray-300 truncate"
          style={{ width: `${100 / columns.length}%` }}
        >
          {col.render(item)}
        </div>
      ))}
    </div>
  );
};

Row.displayName = 'Row';

export default function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = "No records found",
  emptyDescription
}: DataTableProps<T>) {

  const safeData = Array.isArray(data) ? data : [];

  if (loading) {
    return (
      <div className="p-4">
        <Skeleton />
      </div>
    );
  }

  if (safeData.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="w-full bg-[#16191e] border border-[#222630] rounded-xl overflow-hidden">

      <div className="flex border-b border-[#222630] bg-[#0d0f12] p-4">
        {columns.map((col, index) => (
          <div
            key={index}
            className="text-[11px] uppercase text-gray-400 font-bold"
            style={{ width: `${100 / columns.length}%` }}
          >
            {col.header}
          </div>
        ))}
      </div>

      <div>
        {safeData.map((item, index) => (
          <Row<T>
            key={index}
            item={item}
            columns={columns}
          />
        ))}
      </div>

    </div>
  );
}