import { describe, expect, it, vi } from 'vitest';
import { loginToWebArWorker } from '../src/app/webArAuth';

describe('Web-AR Worker auth client', () => {
  it('logs in against the Worker auth route and normalizes the email', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          user: {
            email: 'shibi@example.com',
            role: 'user',
            status: 'active',
          },
          token: 'session-token',
        }),
        { status: 200 },
      );
    });

    const session = await loginToWebArWorker({
      apiUrl: 'https://worker.example/generate-3d',
      email: ' Shibi@Example.COM ',
      password: 'secret',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'shibi@example.com',
        password: 'secret',
      }),
    });
    expect(session).toEqual({
      user: {
        email: 'shibi@example.com',
        role: 'user',
        status: 'active',
      },
      token: 'session-token',
    });
  });
});
