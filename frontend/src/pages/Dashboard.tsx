import { useEffect, useState } from "react";
import axios from "axios";

type RealmOption = {
  connected_realm_id: number;
  label: string;
  population: string;
  status: string;
  region: string;
};

type RealmsResponse = {
  status: string;
  region: string;
  connected_realm_count: number;
  items: RealmOption[];
};

type RealmSelectProps = {
  value: number;
  onChange: (connectedRealmId: number) => void;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const FALLBACK_REALMS: RealmOption[] = [
  {
    connected_realm_id: 11,
    label: "Illidan",
    population: "Unknown",
    status: "Unknown",
    region: "US",
  },
];

export default function RealmSelect({ value, onChange }: RealmSelectProps) {
  const [realms, setRealms] = useState<RealmOption[]>(FALLBACK_REALMS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadRealms() {
      try {
        setLoading(true);

        const response = await axios.get<RealmsResponse>(
          `${API_BASE_URL}/realms`
        );

        if (response.data.status === "Success" && response.data.items.length > 0) {
          setRealms(response.data.items);
        }
      } catch {
        setRealms(FALLBACK_REALMS);
      } finally {
        setLoading(false);
      }
    }

    loadRealms();
  }, []);

  return (
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="max-w-sm rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none transition hover:border-slate-600 focus:border-amber-500"
      title={loading ? "Loading realms..." : "Select connected realm"}
    >
      {realms.map((realm) => (
        <option
          key={realm.connected_realm_id}
          value={realm.connected_realm_id}
        >
          {realm.label} · {realm.population} · {realm.status}
        </option>
      ))}
    </select>
  );
}