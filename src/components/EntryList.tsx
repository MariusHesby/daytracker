"use client";

import { LogEntry, ActivityType } from "@/types";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { Icon, icons, IconName } from "@/components/Icons";

interface EntryListProps {
  entries: LogEntry[];
  onEdit?: (entry: LogEntry) => void;
}

export function EntryList({ entries, onEdit }: EntryListProps) {
  const { activityTypes, deleteEntry } = useApp();

  const getActivityType = (id: string): ActivityType | undefined => {
    return activityTypes.find((t) => t.id === id);
  };

  const formatValue = (entry: LogEntry, type?: ActivityType): string => {
    if (type?.valueType === "boolean") {
      return entry.value ? "Yes" : "No";
    }
    return String(entry.value);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this entry?")) {
      await deleteEntry(id);
    }
  };

  if (entries.length === 0) {
    return (
      <div className='text-center py-8 text-zinc-400 dark:text-zinc-500'>
        <p>No entries for this day</p>
        <p className='text-sm mt-1'>Add your first entry above</p>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      {entries.map((entry) => {
        const type = getActivityType(entry.activityTypeId);

        return (
          <div
            key={entry.id}
            className={cn(
              "p-4 rounded-lg border border-zinc-200 dark:border-zinc-700",
              "bg-white dark:bg-zinc-800",
              "group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors",
            )}>
            <div className='flex items-start justify-between gap-3'>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 mb-1'>
                  {type?.icon &&
                    (type.icon in icons ? (
                      <Icon name={type.icon as IconName} className='w-5 h-5' />
                    ) : (
                      <span className='text-lg'>{type.icon}</span>
                    ))}
                  <span className='font-medium text-zinc-900 dark:text-zinc-100'>
                    {type?.name || "Unknown"}
                  </span>
                </div>
                <p className='text-zinc-600 dark:text-zinc-400 capitalize'>
                  {formatValue(entry, type)}
                </p>
                {entry.note && (
                  <p className='text-sm text-zinc-500 dark:text-zinc-500 mt-1 italic'>
                    {entry.note}
                  </p>
                )}
              </div>

              <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                {onEdit && (
                  <button
                    onClick={() => onEdit(entry)}
                    className='p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'
                    title='Edit'>
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                      />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleDelete(entry.id)}
                  className='p-2 text-zinc-400 hover:text-red-500 transition-colors'
                  title='Delete'>
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
