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
          <Link href="/assistant" className={`${styles.navLink} ${styles.navLinkAi}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"></path>
              <path d="M19 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"></path>
            </svg>
            AI Assistant
          </Link>
          <Link href="/faq" className={styles.navLink}>
            FAQ
          </Link>
          <Link href="/about" className={styles.navLink}>
            About Us
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
