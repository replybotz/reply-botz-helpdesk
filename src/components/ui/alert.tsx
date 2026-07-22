import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  error: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  success: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
} as const;

export function Alert({
  tone,
  className,
  children,
}: {
  tone: keyof typeof TONE_CLASSES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="alert" className={cn('rounded-lg p-3 text-sm', TONE_CLASSES[tone], className)}>
      {children}
    </div>
  );
}
