import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasPrev: boolean;
  hasNext: boolean;
}

interface PaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ pagination, onPageChange }: PaginationProps) => {
  const { currentPage, totalPages } = pagination;

  if (totalPages <= 1) return null;

  const buildPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];

    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages) {
        pages.push(i);
      }
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const handlePageChange = (page: number) => {
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col items-center gap-4 mt-12">
      {/* Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!pagination.hasPrev}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
        >
          <ChevronLeft className="w-4 h-4" />
          Trước
        </button>

        {buildPageNumbers().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && handlePageChange(page)}
            disabled={page === '...'}
            className={`min-w-[40px] h-10 rounded-xl text-sm font-semibold transition-all duration-200 ${
              page === currentPage
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25'
                : page === '...'
                ? 'text-slate-400 cursor-default'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!pagination.hasNext}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
        >
          Sau
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
