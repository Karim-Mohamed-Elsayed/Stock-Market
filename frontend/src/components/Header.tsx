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
          <span className={styles.mark}>V</span>
          Vantage
        </Link>

        <nav className={styles.nav}>
          <Link href="/#markets" className={styles.navLink}>
            Markets
          </Link>
          <Link href="/markets/AAPL" className={styles.navLink}>
            Charts
          </Link>
          <Link href="/insights" className={styles.navLink}>
            Insights & Analytics
          </Link>
          <Link href="/#features" className={styles.navLink}>
            Features
          </Link>
          <Link href="/#sectors" className={styles.navLink}>
            Sectors
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
