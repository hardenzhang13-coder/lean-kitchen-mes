"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string;
  onChange?: (dateString: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "请选择日期",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = value ? parseISO(value) : undefined;

  const handleSelect = (date?: Date) => {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      onChange?.(dateString);
    } else {
      onChange?.("");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center justify-start rounded-md border border-input bg-background px-4 text-left text-base font-normal shadow-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          !value && "text-muted-foreground",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
        {selectedDate ? (
          format(selectedDate, "yyyy年MM月dd日", { locale: zhCN })
        ) : (
          <span>{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={{ code: "zh-CN" }}
        />
      </PopoverContent>
    </Popover>
  );
}
