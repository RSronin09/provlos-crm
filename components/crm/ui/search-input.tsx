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
      type="text"
      name={name}
      placeholder={placeholder}
      defaultValue={defaultValue}
      className={`rounded-md border border-slate-300 px-3 py-2 text-sm ${className}`}
    />
  );
}
