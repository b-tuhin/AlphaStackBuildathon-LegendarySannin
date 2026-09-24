import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar.jsx";
import TopBar from "../components/TopBar.jsx";
import EmailList from "../components/EmailList.jsx";
import EmailView from "../components/EmailView.jsx";
import ComposeModal from "../components/ComposeModal.jsx";
import Settings from "./Settings.jsx";
import ChangePassword from "./ChangePassword.jsx";
import { getMe, getEmails, updateEmail } from "../api/client.js";

export default function Mail() {
  const [me, setMe] = useState(null);
  const [folder, setFolder] = useState("home");
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { getMe().then(({ data }) => setMe(data)); }, []);

  const load = useCallback(async () => {
    const { data } = await getEmails({ folder });
    setEmails(data);
  }, [folder]);

  useEffect(() => { load(); setSelected(null); }, [load]);

  const openEmail = async (email) => {
    setSelected(email);
    if (!email.is_read) {
      await updateEmail(email.id, { is_read: 1 });
      load();
    }
  };

  const filtered = query
    ? emails.filter((e) => `${e.subject} ${e.body_text} ${e.from_address}`.toLowerCase().includes(query.toLowerCase()))
    : emails;

  if (me?.mustChangePassword) return <ChangePassword onDone={() => setMe({ ...me, mustChangePassword: false })} />;

  if (settingsOpen) return <Settings me={me} onBack={() => setSettingsOpen(false)} onUpdated={setMe} />;

  return (
    <div style={styles.app}>
      <TopBar query={query} onQueryChange={setQuery} me={me} onOpenSettings={() => setSettingsOpen(true)} />
      <div style={styles.body}>
        <Sidebar folder={folder} onSelect={setFolder} onCompose={() => setComposing(true)} />
        <EmailList emails={filtered} selectedId={selected?.id} onSelect={openEmail} />
        <EmailView email={selected} refreshList={load} />
      </div>
      {composing && <ComposeModal onClose={() => setComposing(false)} onSent={load} />}
    </div>
  );
}

const styles = {
  app: { display: "flex", flexDirection: "column", height: "100vh" },
  body: { display: "flex", flex: 1, overflow: "hidden" },
};
