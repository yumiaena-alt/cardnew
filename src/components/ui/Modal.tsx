'use client';

import { Dialog } from '@base-ui/react/dialog';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Modal dialog built on the Base UI primitive.
 *
 * Base UI owns focus trapping, scroll locking, and the escape key, so what is
 * added here is only the surface: the wide radius reserved for overlays and the
 * one place shadows are allowed, since a modal has to read as floating above
 * the page rather than as another card in the flow.
 */

const ModalRoot = Dialog.Root;
const ModalClose = Dialog.Close;

/**
 * Dimmed backdrop behind a modal.
 *
 * @param props - Base UI backdrop props.
 * @returns The backdrop element.
 */
function ModalBackdrop(props: Dialog.Backdrop.Props) {
  const { className, ...rest } = props;

  return (
    <Dialog.Backdrop
      data-slot="modal-backdrop"
      className={cn(
        'fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
        className,
      )}
      {...rest}
    />
  );
}

/**
 * The modal surface. Renders its own backdrop so callers cannot forget one.
 *
 * @param props - Base UI popup props.
 * @returns The modal element.
 */
function ModalContent(props: Dialog.Popup.Props) {
  const { className, children, ...rest } = props;

  return (
    <Dialog.Portal>
      <ModalBackdrop />
      <Dialog.Popup
        data-slot="modal-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-lg outline-none transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
          className,
        )}
        {...rest}
      >
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

/**
 * Modal heading. Base UI wires it to the dialog's accessible name.
 *
 * @param props - Base UI title props.
 * @returns The title element.
 */
function ModalTitle(props: Dialog.Title.Props) {
  const { className, ...rest } = props;

  return (
    <Dialog.Title
      data-slot="modal-title"
      className={cn('text-base font-semibold text-foreground', className)}
      {...rest}
    />
  );
}

/**
 * Supporting copy under the modal heading.
 *
 * @param props - Base UI description props.
 * @returns The description element.
 */
function ModalDescription(props: Dialog.Description.Props) {
  const { className, ...rest } = props;

  return (
    <Dialog.Description
      data-slot="modal-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...rest}
    />
  );
}

/**
 * Action row pinned to the end of a modal.
 *
 * @param props - Standard div props.
 * @returns The footer element.
 */
function ModalFooter(props: React.ComponentProps<'div'>) {
  const { className, ...rest } = props;

  return (
    <div
      data-slot="modal-footer"
      className={cn('flex flex-wrap items-center justify-end gap-2', className)}
      {...rest}
    />
  );
}

export { ModalClose, ModalContent, ModalDescription, ModalFooter, ModalRoot, ModalTitle };
