import React, { useEffect, useState } from "react";

interface Realm {
  id: number;
  name: string;
}

interface RealmSelectorProps {
  selectedRealm: number;
  onRealmChange: (id: number) => void;
}

export default function RealmSelector({ selectedRealm, onRealmChange }: RealmSelectorProps) {
  const [realms, setRealms] = useState<Realm[]>([]);

  useEffect(() => {
    // Queries the backend to dynamically pull the updated collection matrix array
    fetch("http://localhost:8000/api/realms")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRealms(data);
        }
      })
      .catch((err) => console.error("Failed loading dropdown network targets:", err));
  }, []);

  return (
    <select
      value={selectedRealm}
      onChange={(e) => onRealmChange(Number(e.target.value))}
      className="bg-slate-800 text-white px-4 py-2 rounded-md border border-slate-700 outline-none cursor-pointer focus:border-amber-500"
    >
      {realms.map((realm) => (
        <option key={realm.id} value={realm.id}>
          {realm.name}
        </option>
      ))}
    </select>
  );
}