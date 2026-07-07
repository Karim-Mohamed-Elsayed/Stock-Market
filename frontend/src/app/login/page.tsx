"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import btn from "@/components/Button.module.css";
import { ApiError, loginUser } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await loginUser({ email, password });
      await refresh();
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Log in</h1>
          <p className={styles.subtitle}>Welcome back. Enter your details to continue.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className={styles.input}
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${btn.btn} ${btn.primary} ${btn.block} ${styles.submit}`}
          >
            {isSubmitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className={styles.footerText}>
          New to Axiom? <Link href="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
