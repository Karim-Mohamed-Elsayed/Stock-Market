"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";

import btn from "./Button.module.css";
import styles from "./Header.module.css";

export default function Header() {
  const { profile, isLoading, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Link href="/" className={styles.logo}>
          <img src="/logo/light_logo.png" alt="Meridian Axiom Logo" style={{ width: 96, height: 96, objectFit: 'contain' }} />
          Meridian Axiom
        </Link>

        <nav className={styles.nav}>

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
