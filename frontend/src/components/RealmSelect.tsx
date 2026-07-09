import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  getGlobalRealmId,
  listenForGlobalRealmChange,
  setGlobalRealmId,
} from "../utils/globalRealm";

type RealmOption = {
  connected_realm_id: number;
  realm_id?: number;
  name: string;
  slug?: string;
  region?: string;
};

type RealmApiRealm = {
  id?: number;
  realm_id?: number;
  name?: string;
  slug?: string;
};

type RealmApiItem = {
  connected_realm_id?: number;
  id?: number;
  name?: string;
  slug?: string;
  region?: string;
  realms?: RealmApiRealm[];
};

type RealmSelectProps = {
  value?: number;
  onChange?: (connectedRealmId: number) => void;
  className?: string;
  master?: boolean;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

function buildRealmOptions(items: RealmApiItem[]): RealmOption[] {
  const options: RealmOption[] = [];

  for (const item of items) {
    const connectedRealmId = Number(item.connected_realm_id ?? item.id);

    if (!Number.isFinite(connectedRealmId) || connectedRealmId <= 0) {
      continue;
    }

    if (Array.isArray(item.realms) && item.realms.length > 0) {
      for (const realm of item.realms) {
        options.push({
          connected_realm_id: connectedRealmId,
          realm_id: Number(realm.realm_id ?? realm.id),
          name: realm.name ?? item.name ?? `Realm ${connectedRealmId}`,
          slug: realm.slug ?? item.slug,
          region: item.region,
        });
      }
    } else {
      options.push({
        connected_realm_id: connectedRealmId,
        name: item.name ?? `Connected Realm ${connectedRealmId}`,
        slug: item.slug,
        region: item.region,
      });
    }
  }

  const deduped = new Map<string, RealmOption>();

  for (const option of options) {
    const key = `${option.connected_realm_id}-${option.name}`;

    if (!deduped.has(key)) {
      deduped.set(key, option);
    }
  }

  return [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function HiddenRealmBridge({ value, onChange }: RealmSelectProps) {
  useEffect(() => {
    const globalRealm = getGlobalRealmId(value ?? 11);
    onChange?.(globalRealm);

    return listenForGlobalRealmChange((realmId) => {
      onChange?.(realmId);
    });
  }, [onChange, value]);

  return null;
}

function MasterRealmSelect({
  value,
  onChange,
  className = "",
}: RealmSelectProps) {
  const [options, setOptions] = useState<RealmOption[]>([]);
  const [selectedRealm, setSelectedRealm] = useState(() =>
    getGlobalRealmId(value ?? 11),
  );
  const [loading, setLoading] = useState(false);

  const visibleOptions = useMemo(() => {
    const hasSelected = options.some(
      (option) => option.connected_realm_id === selectedRealm,
    );

    if (hasSelected) {
      return options;
    }

    return [
      {
        connected_realm_id: selectedRealm,
        name: `Realm ${selectedRealm}`,
      },
      ...options,
    ];
  }, [options, selectedRealm]);

  const currentRealmName = useMemo(() => {
    return (
      visibleOptions.find(
        (option) => option.connected_realm_id === selectedRealm,
      )?.name ?? `Realm ${selectedRealm}`
    );
  }, [visibleOptions, selectedRealm]);

  function applyRealm(realmId: number) {
    if (!Number.isFinite(realmId) || realmId <= 0) {
      return;
    }

    setSelectedRealm(realmId);
    setGlobalRealmId(realmId);
    onChange?.(realmId);
  }

  async function loadRealms() {
    try {
      setLoading(true);

      const response = await axios.get(`${API_BASE_URL}/realms`);
      const rawItems = Array.isArray(response.data)
        ? response.data
        : response.data?.items ?? response.data?.realms ?? [];

      const nextOptions = buildRealmOptions(rawItems);

      if (nextOptions.length > 0) {
        setOptions(nextOptions);
      }
    } catch {
      // Keep the current selected global realm visible even if realms fail to load.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRealms();
  }, []);

  useEffect(() => {
    const globalRealm = getGlobalRealmId(value ?? 11);

    setSelectedRealm(globalRealm);
    onChange?.(globalRealm);
  }, []);

  useEffect(() => {
    return listenForGlobalRealmChange((realmId) => {
      setSelectedRealm(realmId);
      onChange?.(realmId);
    });
  }, [onChange]);

  useEffect(() => {
    if (value && value !== selectedRealm) {
      setSelectedRealm(value);
    }
  }, [value, selectedRealm]);

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedRealm}
        onChange={(event) => applyRealm(Number(event.target.value))}
        disabled={loading}
        title={`Global realm: ${currentRealmName}`}
        className="min-w-[210px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-amber-500 disabled:opacity-60"
      >
        {visibleOptions.map((option) => (
          <option
            key={`${option.connected_realm_id}-${option.name}`}
            value={option.connected_realm_id}
          >
            {option.name}
            {option.region ? ` - ${option.region}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function RealmSelect(props: RealmSelectProps) {
  if (!props.master) {
    return <HiddenRealmBridge {...props} />;
  }

  return <MasterRealmSelect {...props} />;
}
