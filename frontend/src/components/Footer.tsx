"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import styles from "./Footer.module.css";

export default function Footer() {
  const pathname = usePathname();
  const { profile, isLoading } = useAuth();
  const isLoggedIn = !isLoading && profile !== null;
  // Hide the footer on the full-height chart and AI assistant pages
  if (pathname && (pathname.startsWith("/markets/") || pathname === "/assistant")) {
    return null;
  }
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div>
            <div className={styles.brand}>
              <img src="/logo/light_logo.png" alt="Meridian Axiom Logo" style={{ width: 96, height: 96, objectFit: 'contain' }} />
              Meridian Axiom
            </div>
            <p className={styles.tagline}>
              Market data, technical indicators, and watchlists for the S&amp;P
              500  in one dashboard.
            </p>
          </div>

          <div>
            <div className={styles.heading}>Product</div>
            <div className={styles.links}>
              <Link href="/markets/AAPL">Charts</Link>
              <Link href="/insights">Insights &amp; Analytics</Link>
              <Link href="/assistant">AI Assistant</Link>
            </div>
          </div>

          {!isLoggedIn && (
            <div>
              <div className={styles.heading}>Account</div>
              <div className={styles.links}>
                <Link href="/login">Log in</Link>
                <Link href="/register">Create account</Link>
              </div>
            </div>
          )}

          <div>
            <div className={styles.heading}>Company</div>
            <div className={styles.links}>
              <Link href="/about">About us</Link>
              <Link href="/faq">FAQ</Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer noopener"
              >
                GitHub
              </a>
              <a href="mailto:hello@meridianaxiom.markets">Contact</a>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copyright}>
            &copy; {new Date().getFullYear()} Meridian Axiom Markets.
          </span>
          <p className={styles.disclaimer}>
            Market data may be delayed and is provided for informational
            purposes only. Nothing on this site is investment advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
