type SearchInputProps = {
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
};

export function SearchInput({
  name = "search",
  placeholder = "Search...",
  defaultValue,
  className = "",
}: SearchInputProps) {
  return (
    <input
      type="search"
      name={name}
      placeholder={placeholder}
      defaultValue={defaultValue}
      autoComplete="off"
      className={`w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${className}`}
    />
  );
}
