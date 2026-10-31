import { Skeleton } from '@/components/ui/skeleton'
import { TableBody, TableCell, TableRow } from '@/components/ui/table'

const rows = [0, 1, 2, 3, 4]

export const TableSkeleton = ({ columns = 5 }: { columns?: number }) => (
  <TableBody>
    {rows.map((row) => (
      <TableRow key={`skeleton-row-${row}`}>
        {Array.from({ length: columns }, (_, column) => (
          <TableCell key={`skeleton-cell-${row}-${column}`}>
            <Skeleton className={column === 0 ? 'h-4 w-40' : 'h-4 w-24'} />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </TableBody>
)
