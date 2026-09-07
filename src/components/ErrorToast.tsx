interface ErrorToastProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  return (
    <div class="error-toast" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" aria-label="Zamknij komunikat" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}
