"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";

import btn from "./Button.module.css";
import styles from "./Header.module.css";

export default function Header() {
  const { profile, isLoading, logout } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    router.push(`/markets/${search.trim().toUpperCase()}`);
    setSearch("");
  }

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Link href="/" className={styles.logo}>
          <img src="/logo/light_logo.png" alt="Meridian Axiom Logo" style={{ width: 96, height: 96, objectFit: 'contain' }} />
          Meridian Axiom
        </Link>

        <nav className={styles.nav} style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '24px', padding: '6px 16px', transition: 'border-color 0.2s' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticker..." 
              style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', width: '130px', fontSize: '15px' }}
            />
          </form>

          <Link href="/markets/AAPL" className={styles.navLink}>
            Charts
          </Link>
          <Link href="/insights" className={styles.navLink}>
            Insights & Analytics
          </Link>
        </nav>

        <div className={styles.actions}>
          {isLoading ? null : profile ? (
            <>
              <span className={styles.greeting}>{profile.email}</span>
              <button
                type="button"
                className={`${btn.btn} ${btn.secondary}`}
                onClick={handleLogout}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={`${btn.btn} ${btn.ghost}`}>
                Log in
              </Link>
              <Link href="/register" className={`${btn.btn} ${btn.primary}`}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
