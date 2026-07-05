"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import btn from "@/components/Button.module.css";
import { ApiError, registerUser } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerUser({
        email,
        password,
        full_name: fullName || undefined,
      });

      if (result.authenticated) {
        await refresh();
        router.push("/");
        router.refresh();
        return;
      }

      setMessage(result.message);
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
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>Track the market and build a watchlist in under a minute.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error ? <div className={styles.error}>{error}</div> : null}
          {message ? <div className={styles.success}>{message}</div> : null}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              className={styles.input}
              placeholder="Jane Doe"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={8}
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <span className={styles.hint}>At least 8 characters.</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={styles.input}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${btn.btn} ${btn.primary} ${btn.block} ${styles.submit}`}
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className={styles.footerText}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
