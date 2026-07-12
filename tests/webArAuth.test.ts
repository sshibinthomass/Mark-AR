import { describe, expect, it, vi } from 'vitest';
import {
  AuthRequestError,
  isAuthRequestError,
  loginToWebArWorker,
  signupToWebArWorker,
} from '../src/app/webArAuth';

describe('Web-AR Worker auth client', () => {
  it('creates a pending account through the Worker signup route', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          user: {
            email: 'maker@example.com',
            name: 'Maker',
            role: 'user',
            status: 'pending',
          },
        }),
        { status: 201 },
      );
    });

    const session = await signupToWebArWorker({
      apiUrl: 'https://worker.example/generate-3d',
      email: ' Maker@Example.COM ',
      password: 'maker-password-123',
      name: ' Maker ',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'maker@example.com',
        password: 'maker-password-123',
        name: 'Maker',
      }),
    });
    expect(session).toEqual({
      user: {
        email: 'maker@example.com',
        name: 'Maker',
        role: 'user',
        status: 'pending',
      },
      token: null,
    });
  });

  it('rejects a whitespace-only signup name without calling the Worker', async () => {
    const fetchImpl = vi.fn();

    await expect(signupToWebArWorker({
      apiUrl: 'https://worker.example/generate-3d',
      email: 'maker@example.com',
      password: 'maker-password-123',
      name: '   ',
      fetchImpl,
    })).rejects.toThrow('Name is required.');

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('preserves the HTTP status for an existing-account signup conflict', async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ error: 'Account already exists.' }),
      { status: 409 },
    ));

    const error = await signupToWebArWorker({
      apiUrl: 'https://worker.example/generate-3d',
      email: 'maker@example.com',
      password: 'maker-password-123',
      name: 'Maker',
      fetchImpl,
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(AuthRequestError);
    expect(error).toMatchObject({ message: 'Account already exists.', status: 409 });
    expect(isAuthRequestError(error, 409)).toBe(true);
    expect(isAuthRequestError(error, 400)).toBe(false);
  });

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
