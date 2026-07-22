import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

describe('Button', () => {
  it('renders its children and default variant classes', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('bg-zinc-900');
  });

  it('applies the outline variant', () => {
    render(<Button variant="outline">Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('border');
  });

  it('renders as the child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/somewhere">Go</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('href', '/somewhere');
  });

  it('respects disabled', () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole('button', { name: 'Nope' })).toBeDisabled();
  });
});

describe('Badge', () => {
  it('merges custom color classes', () => {
    render(<Badge className="bg-blue-100">OPEN</Badge>);
    const badge = screen.getByText('OPEN');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('bg-blue-100');
  });
});

describe('Alert', () => {
  it('announces itself with role=alert', () => {
    render(<Alert tone="error">Something failed</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something failed');
    expect(alert.className).toContain('text-red-600');
  });

  it('supports a success tone', () => {
    render(<Alert tone="success">Saved</Alert>);
    expect(screen.getByRole('alert').className).toContain('text-green-600');
  });
});
