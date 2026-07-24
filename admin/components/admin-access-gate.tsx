'use client';

import { FormEvent, PropsWithChildren, useState, useSyncExternalStore } from 'react';
import { api, getAdminToken, setAdminToken } from '@/services/api';

export function AdminAccessGate({ children }: PropsWithChildren) {
    const [loggedIn, setLoggedIn] = useState(false);
    const storedToken = useSyncExternalStore(
        () => () => {},
        () => Boolean(getAdminToken()),
        () => false,
    );
    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    async function login(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        try {
            const response = await api.post('/admin/login', { code });
            const token = response.headers['x-admin-token'];
            if (!token) throw new Error('Server did not return an admin token.');
            setAdminToken(token);
            setLoggedIn(true);
        } catch {
            setError('???????.');
        }
    }

    if (loggedIn || storedToken) return children;

    return (
        <main className="grid min-h-dvh place-items-center bg-background p-4">
            <form
                onSubmit={login}
                className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6 shadow-lg"
            >
                <h1 className="font-display text-2xl font-extrabold">CHAN ĐÊ</h1>
                <label className="block space-y-2 font-semibold">
                    <input
                        value={code}
                        type="password"
                        onChange={(event) => setCode(event.target.value)}
                        inputMode="numeric"
                        autoFocus
                        required
                        className="w-full rounded-lg border border-line bg-background px-3 py-2"
                    />
                </label>
                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}
                <button className="min-h-11 w-full rounded-lg bg-signal px-4 font-extrabold text-background">
                    Vào admin
                </button>
            </form>
        </main>
    );
}
