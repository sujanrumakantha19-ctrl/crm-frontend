import { useMemo } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount?: number;
  perPage?: number;
  itemName?: string;
  className?: string;
  siblingCount?: number;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  totalCount,
  perPage,
  itemName = 'items',
  className,
  siblingCount = 1,
}: PaginationControlsProps) {
  const pageNumbers = useMemo<(number | 'ellipsis-left' | 'ellipsis-right')[]>(() => {
    if (totalPages <= 1) return [];

    const totalSlots = 5 + siblingCount * 2;
    if (totalPages <= totalSlots) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];
    const leftSibling = Math.max(currentPage - siblingCount, 1);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftEllipsis = leftSibling > 2;
    const shouldShowRightEllipsis = rightSibling < totalPages - 1;

    // Case 1: No left ellipsis, but right ellipsis needed (e.g. 1 2 3 4 ... 165)
    if (!shouldShowLeftEllipsis && shouldShowRightEllipsis) {
      const leftRangeCount = 3 + 2 * siblingCount;
      for (let i = 1; i <= leftRangeCount; i++) {
        pages.push(i);
      }
      pages.push('ellipsis-right');
      pages.push(totalPages);
      return pages;
    }

    // Case 2: Left ellipsis needed, but no right ellipsis (e.g. 1 ... 162 163 164 165)
    if (shouldShowLeftEllipsis && !shouldShowRightEllipsis) {
      pages.push(1);
      pages.push('ellipsis-left');
      const rightRangeCount = 3 + 2 * siblingCount;
      for (let i = totalPages - rightRangeCount + 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    // Case 3: Both left and right ellipsis needed (e.g. 1 ... 49 50 51 ... 165)
    if (shouldShowLeftEllipsis && shouldShowRightEllipsis) {
      pages.push(1);
      pages.push('ellipsis-left');
      for (let i = leftSibling; i <= rightSibling; i++) {
        pages.push(i);
      }
      pages.push('ellipsis-right');
      pages.push(totalPages);
      return pages;
    }

    return pages;
  }, [currentPage, totalPages, siblingCount]);

  if (totalPages <= 1) return null;

  const startItem = perPage ? (currentPage - 1) * perPage + 1 : undefined;
  const endItem = perPage && totalCount !== undefined ? Math.min(currentPage * perPage, totalCount) : undefined;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-slate-200 rounded-lg bg-white shadow-sm',
        className
      )}
    >
      {totalCount !== undefined && startItem !== undefined && endItem !== undefined ? (
        <p className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{startItem}</span> to{' '}
          <span className="font-bold text-slate-800">{endItem}</span> of{' '}
          <span className="font-bold text-slate-800">{totalCount}</span> {itemName}
        </p>
      ) : (
        <p className="text-xs text-slate-500 font-medium">
          Page <span className="font-bold text-slate-800">{currentPage}</span> of{' '}
          <span className="font-bold text-slate-800">{totalPages}</span>
        </p>
      )}

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent className="flex-wrap gap-1">
          <PaginationItem>
            <PaginationPrevious
              onClick={(e) => {
                e.preventDefault();
                if (currentPage > 1) onPageChange(currentPage - 1);
              }}
              className={cn(
                'cursor-pointer select-none text-xs h-8 px-2.5 font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md',
                currentPage === 1 && 'opacity-30 pointer-events-none cursor-not-allowed'
              )}
            />
          </PaginationItem>

          {pageNumbers.map((p, idx) => {
            if (p === 'ellipsis-left' || p === 'ellipsis-right') {
              return (
                <PaginationItem key={`${p}-${idx}`}>
                  <PaginationEllipsis className="w-8 h-8 text-slate-400 select-none text-xs" />
                </PaginationItem>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={isCurrent}
                  onClick={(e) => {
                    e.preventDefault();
                    if (p !== currentPage) onPageChange(p);
                  }}
                  className={cn(
                    'cursor-pointer select-none w-8 h-8 rounded-md text-xs font-bold transition-all',
                    isCurrent
                      ? 'bg-brand-blue text-white shadow-sm border-brand-blue hover:bg-brand-blue hover:text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            );
          })}

          <PaginationItem>
            <PaginationNext
              onClick={(e) => {
                e.preventDefault();
                if (currentPage < totalPages) onPageChange(currentPage + 1);
              }}
              className={cn(
                'cursor-pointer select-none text-xs h-8 px-2.5 font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md',
                currentPage === totalPages && 'opacity-30 pointer-events-none cursor-not-allowed'
              )}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
