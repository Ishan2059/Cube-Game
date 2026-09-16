import { playerNameError } from '@/lib/player-name';

export function validateNameInput(inputId: string, errorId: string, buttonId: string, showEmpty = false): boolean {
  const input = document.getElementById(inputId) as HTMLInputElement;
  const error = document.getElementById(errorId)!;
  const button = document.getElementById(buttonId) as HTMLButtonElement;
  const message = playerNameError(input.value);
  const visibleMessage = input.value || showEmpty ? message : null;
  error.textContent = visibleMessage || '';
  input.setAttribute('aria-invalid', String(!!visibleMessage));
  button.disabled = !!message;
  return !message;
}
