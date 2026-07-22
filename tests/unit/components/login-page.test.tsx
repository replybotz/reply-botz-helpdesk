import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = jest.fn();
const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

import LoginPage from '@/app/(auth)/login/page';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'acme' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter22' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

describe('LoginPage', () => {
  it('navigates to the dashboard on success without touching web storage', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { email: 'a@b.co' } }),
    });

    render(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    // Tokens live in httpOnly cookies — nothing may be written to storage.
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('routes to /mfa when the server requests a second factor', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ requiresMfa: true }),
    });

    render(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/mfa'));
  });

  it('shows the server error in an alert on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid email or password' }),
    });

    render(<LoginPage />);
    fillAndSubmit();

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
