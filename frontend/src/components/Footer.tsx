import Link from "next/link";

import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div>
            <div className={styles.brand}>
              <span className={styles.mark}>V</span>
              Vantage
            </div>
            <p className={styles.tagline}>
              Market data, technical indicators, and watchlists for the S&amp;P
              500 — in one dashboard.
            </p>
          </div>

          <div>
            <div className={styles.heading}>Product</div>
            <div className={styles.links}>
              <Link href="/#markets">Markets</Link>
              <Link href="/#features">Features</Link>
              <Link href="/#sectors">Sectors</Link>
            </div>
          </div>

          <div>
            <div className={styles.heading}>Account</div>
            <div className={styles.links}>
              <Link href="/login">Log in</Link>
              <Link href="/register">Create account</Link>
            </div>
          </div>

          <div>
            <div className={styles.heading}>Company</div>
            <div className={styles.links}>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer noopener"
              >
                GitHub
              </a>
              <a href="mailto:hello@vantage.markets">Contact</a>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copyright}>
            &copy; {new Date().getFullYear()} Vantage Markets.
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
