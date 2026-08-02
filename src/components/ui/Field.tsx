'use client';

import { Select as SelectBase } from '@base-ui/react/select';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Form field primitives.
 *
 * Field radius is deliberately tighter than card radius, which is what the
 * design system means by non-uniform rounding: controls read as controls
 * because they are shaped differently from the surfaces holding them.
 */

const fieldClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50';

/**
 * Multi-line text input for topics long enough to need room.
 *
 * @param props - Standard textarea props.
 * @returns The textarea element.
 */
export function Textarea(props: React.ComponentProps<'textarea'>) {
  const { className, ...rest } = props;

  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, 'h-auto min-h-24 resize-y py-2 leading-relaxed', className)}
      {...rest}
    />
  );
}

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  'aria-label': string;
};

/**
 * Single-choice select.
 *
 * Built on the Base UI primitive so keyboard behaviour and the listbox roles
 * come from the library rather than being re-implemented per form.
 *
 * @param props - Current value, change handler, options, and accessible name.
 * @returns The select control.
 */
export function Select(props: SelectProps) {
  const selected = props.options.find((option) => option.value === props.value);

  return (
    <SelectBase.Root
      value={props.value}
      // Base UI reports null when a selection is cleared. This select is always
      // required, so a clear is treated as "keep what was chosen" rather than
      // widening every caller's handler to accept an empty value.
      onValueChange={(value) => {
        if (value !== null) {
          props.onValueChange(value);
        }
      }}
    >
      <SelectBase.Trigger
        data-slot="select-trigger"
        aria-label={props['aria-label']}
        className={cn(fieldClass, 'flex items-center justify-between gap-2 text-left')}
      >
        <SelectBase.Value>{selected?.label ?? ''}</SelectBase.Value>
      </SelectBase.Trigger>

      <SelectBase.Portal>
        <SelectBase.Positioner sideOffset={4} className="z-50">
          <SelectBase.Popup className="max-h-64 min-w-(--anchor-width) overflow-auto rounded-md border border-border bg-card p-1 shadow-md outline-none">
            {props.options.map((option) => (
              <SelectBase.Item
                key={option.value}
                value={option.value}
                className="cursor-default rounded-sm px-2 py-1.5 text-sm text-foreground outline-none select-none data-highlighted:bg-accent data-selected:font-medium"
              >
                <SelectBase.ItemText>{option.label}</SelectBase.ItemText>
              </SelectBase.Item>
            ))}
          </SelectBase.Popup>
        </SelectBase.Positioner>
      </SelectBase.Portal>
    </SelectBase.Root>
  );
}

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
};

/**
 * Label, control, and optional hint as one block.
 *
 * @param props - Label text, optional hint, and the control.
 * @returns The labelled field.
 */
export function Field(props: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={props.htmlFor} className="text-sm font-medium text-foreground">
        {props.label}
      </label>
      {props.children}
      {props.hint ? <p className="text-xs text-muted-foreground">{props.hint}</p> : null}
    </div>
  );
}
