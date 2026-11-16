"use client";

import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SCHEDULE_STATUS_OPTIONS } from "@/lib/shared/schedule-status";

interface StatusColumnMenuProps {
  /** 当前展示的状态列 */
  visible: readonly string[];
  onChange: (next: string[]) => void;
}

/** 看板状态列显隐：勾选决定列表展示哪几个状态，至少保留一列。 */
export function StatusColumnMenu({ visible, onChange }: StatusColumnMenuProps) {
  const toggle = (status: string, checked: boolean) => {
    const next = checked
      ? [...visible, status]
      : visible.filter((item) => item !== status);
    if (next.length === 0) return;
    onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" type="button">
            <Columns3 className="mr-1.5 h-4 w-4" />
            状态显示
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>列表展示的状态</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SCHEDULE_STATUS_OPTIONS.map((option) => {
            const checked = visible.includes(option.value);
            // 最后一个是勾选态时禁用，避免把看板清空
            const isLastVisible = checked && visible.length === 1;
            return (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={checked}
                disabled={isLastVisible}
                onCheckedChange={(next) => toggle(option.value, next === true)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
