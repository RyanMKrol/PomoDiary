import { Header } from "@/components/Header";
import { Panels } from "@/components/Panels";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.appContainer}>
      <Header />
      <Panels />
    </div>
  );
}
