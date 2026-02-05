"use client"

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/c-app-header';

function isAllowedAdminEmail(email: string | null | undefined) {
  const localPart = String(email || '').split('@')[0]?.trim().toLowerCase();
  return localPart === 'chiu3';
}

export default function AdminPage() {
  const [isAllowed, setIsAllowed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isAllowedAdminEmail(localStorage.getItem('userEmail'));
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsAllowed(isAllowedAdminEmail(localStorage.getItem('userEmail')));
  }, []);

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-gray-100">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Not Found</h1>
            <p className="mt-2 text-sm text-gray-600">
              This page is not available.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="mt-2 text-sm text-gray-600">
            Marketing features have been removed from the core app.
          </p>
        </div>
      </main>
    </div>
  );
}