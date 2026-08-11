import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/utils/cn";

interface SearchToolbarBaseProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Toolbar container for search input + action buttons.
 * Usage (children mode):
 *   <SearchToolbar>
 *     <SearchInput ... />
 *     <Button>Filter</Button>
 *   </SearchToolbar>
 *
 * Usage (convenience props mode):
 *   <SearchToolbar
 *     searchPlaceholder="Cari..."
 *     searchValue={query}
 *     onSearchChange={setQuery}
 *   >
 *     <Button>Filter</Button>
 *   </SearchToolbar>
 */
export function SearchToolbar({
  children,
  className,
  searchPlaceholder,
  searchValue,
  onSearchChange,
}: SearchToolbarBaseProps & {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-surface border border-border bg-surface p-card shadow-surface sm:flex-row sm:items-center",
        className,
      )}
    >
      {searchPlaceholder != null ? (
        <SearchInput
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={searchValue}
          onChange={onSearchChange}
        />
      ) : null}
      {children != null ? (
        <div className="flex w-full flex-wrap gap-2 [&>button]:min-w-0 [&>button]:flex-1 sm:ml-auto sm:w-auto sm:justify-end sm:[&>button]:flex-none">{children}</div>
      ) : null}
    </div>
  );
}
