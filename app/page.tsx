import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>Codex Protocol (v3)</h1>
      <p>M001: Local conversational UI scaffolding is active.</p>
      <div className={styles.statusBox}>
        <p>Database: SQLite (better-sqlite3)</p>
        <p>Provider: Deterministic Mock</p>
      </div>
    </main>
  );
}
