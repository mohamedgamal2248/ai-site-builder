"use client";

import { useState, useSyncExternalStore } from "react";
import { readNicknames, setNickname, subscribeNicknames } from "@/lib/nicknames";

const useNick = (id: string) => useSyncExternalStore(subscribeNicknames, () => readNicknames()[id] ?? "", () => "");

/** Shows your private nickname next to an address, if you gave it one. */
export function Nick({ id }: { id: string }) {
  const nick = useNick(id);
  return nick ? <span className="nick">{nick}</span> : null;
}

/** "Name this wallet" button on the account page. */
export function NickButton({ id, labels }: { id: string; labels: { name: string; rename: string; prompt: string; save: string; remove: string } }) {
  const nick = useNick(id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  if (editing) {
    return (
      <form
        className="nick-form"
        onSubmit={(e) => {
          e.preventDefault();
          setNickname(id, value);
          setEditing(false);
        }}
      >
        <input autoFocus value={value} maxLength={32} placeholder={labels.prompt} aria-label={labels.prompt} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="btn">{labels.save}</button>
        {nick ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setNickname(id, "");
              setEditing(false);
            }}
          >
            {labels.remove}
          </button>
        ) : null}
      </form>
    );
  }
  return (
    <button
      type="button"
      className="watch-btn"
      onClick={() => {
        setValue(nick);
        setEditing(true);
      }}
    >
      ✎ {nick ? `${labels.rename}: ${nick}` : labels.name}
    </button>
  );
}
