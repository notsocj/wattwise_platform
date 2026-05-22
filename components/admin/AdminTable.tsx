import type { ReactNode } from "react";

type AdminTableAlign = "left" | "center" | "right";

interface AdminTableColumn {
  key: string;
  header: ReactNode;
  align?: AdminTableAlign;
  className?: string;
}

interface AdminTableProps {
  columns: AdminTableColumn[];
  rows: Record<string, ReactNode>[];
  emptyState?: ReactNode;
}

const alignStyles: Record<AdminTableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export default function AdminTable({
  columns,
  rows,
  emptyState,
}: AdminTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02]">
        {emptyState ?? (
          <div className="px-4 py-10 text-center text-sm text-white/50">
            No records to display.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/[0.03]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 ${
                    alignStyles[column.align ?? "left"]
                  } ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-surface">
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="transition-colors hover:bg-white/[0.02]"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-sm text-white/70 ${
                      alignStyles[column.align ?? "left"]
                    } ${column.className ?? ""}`}
                  >
                    {row[column.key] ?? null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
