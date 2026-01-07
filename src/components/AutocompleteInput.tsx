"use client";

import { useState, useEffect, useRef } from "react";
import { Suggestion } from "@/types";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  getSuggestions: () => Promise<Suggestion[]>;
  placeholder?: string;
  className?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  getSuggestions,
  placeholder,
  className,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    async function loadSuggestions() {
      const sugg = await getSuggestions();
      setSuggestions(sugg);
    }
    loadSuggestions();
  }, [getSuggestions]);

  const filteredSuggestions = suggestions.filter((s) =>
    s.value.toLowerCase().includes(value.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    onChange(suggestion.value);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredSuggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSuggestionClick(filteredSuggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className='relative'>
      <input
        ref={inputRef}
        type='text'
        value={value}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700",
          "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100",
          "focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500",
          "transition-colors",
          className
        )}
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <ul
          ref={listRef}
          className='absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-auto'>
          {filteredSuggestions.slice(0, 10).map((suggestion, index) => (
            <li
              key={suggestion.value}
              onClick={() => handleSuggestionClick(suggestion)}
              className={cn(
                "px-3 py-2 cursor-pointer transition-colors",
                "hover:bg-zinc-100 dark:hover:bg-zinc-700",
                highlightedIndex === index && "bg-zinc-100 dark:bg-zinc-700"
              )}>
              <span className='text-zinc-900 dark:text-zinc-100 capitalize'>
                {suggestion.value}
              </span>
              <span className='text-zinc-400 dark:text-zinc-500 text-sm ml-2'>
                ({suggestion.count}×)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
