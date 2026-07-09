import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type RealmOption = {
  connected_realm_id: number;
  label: string;
  name: string;
  realm_count: number;
  realm_names: string[];
  population: string;
  status: string;
  region: string;
};

type ExpandedRealmOption = {
  option_id: string;
  connected_realm_id: number;
  realm_name: string;
  connected_realm_label: string;
  realm_count: number;
  population: string;
  status: string;
  region: string;
  linked_realms: string[];
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

const DEFAULT_REALM_STORAGE_KEY = "goldsmith.defaultRealm";

const FALLBACK_REALMS: RealmOption[] = [
  {
    connected_realm_id: 11,
    label: "Illidan",
    name: "Illidan",
    realm_count: 1,
    realm_names: ["Illidan"],
    population: "Unknown",
    status: "Unknown",
    region: "US",
  },
];

function getRealmNames(realm: RealmOption) {
  if (realm.realm_names && realm.realm_names.length > 0) {
    return realm.realm_names;
  }

  if (realm.name) {
    return [realm.name];
  }

  return [realm.label];
}

function getStatusDot(status: string) {
  const normalisedStatus = status.trim().toLowerCase();

  if (normalisedStatus === "up") {
    return "🟢";
  }

  if (normalisedStatus === "down" || normalisedStatus === "offline") {
    return "🔴";
  }

  return "🟡";
}

function getDropdownLabel(option: ExpandedRealmOption) {
  const statusDot = getStatusDot(option.status);

  return `${statusDot} ${option.realm_name} · ${option.population}`;
}

function getFullRealmTitle(option: ExpandedRealmOption) {
  if (option.realm_count <= 1) {
    return `${option.region} Connected Realm ${option.connected_realm_id}: ${option.realm_name}`;
  }

  return `${option.region} Connected Realm ${
    option.connected_realm_id
  }: ${option.realm_name} shares auction house with ${option.linked_realms.join(
    ", "
  )}`;
}

function expandRealms(realms: RealmOption[]) {
  const expandedOptions: ExpandedRealmOption[] = [];

  realms.forEach((realm) => {
    const realmNames = getRealmNames(realm).sort((a, b) =>
      a.localeCompare(b)
    );

    realmNames.forEach((realmName) => {
      const linkedRealms = realmNames.filter(
        (linkedRealmName) => linkedRealmName !== realmName
      );

      expandedOptions.push({
        option_id: `${realm.connected_realm_id}-${realmName}`,
        connected_realm_id: realm.connected_realm_id,
        realm_name: realmName,
        connected_realm_label: realm.label,
        realm_count: realmNames.length,
        population: realm.population,
        status: realm.status,
        region: realm.region,
        linked_realms: linkedRealms,
      });
    });
  });

  return expandedOptions.sort((a, b) =>
    a.realm_name.localeCompare(b.realm_name)
  );
}

function readStoredRealmSelection() {
  try {
    const storedValue = localStorage.getItem(DEFAULT_REALM_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    return JSON.parse(storedValue) as {
      option_id: string;
      connected_realm_id: number;
      realm_name: string;
    };
  } catch {
    return null;
  }
}

function saveStoredRealmSelection(option: ExpandedRealmOption) {
  localStorage.setItem(
    DEFAULT_REALM_STORAGE_KEY,
    JSON.stringify({
      option_id: option.option_id,
      connected_realm_id: option.connected_realm_id,
      realm_name: option.realm_name,
    })
  );
}

export default function RealmSelect({ value, onChange }: RealmSelectProps) {
  const [realms, setRealms] = useState<RealmOption[]>(FALLBACK_REALMS);
  const [loading, setLoading] = useState(false);
  const [realmsLoaded, setRealmsLoaded] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [storedDefaultApplied, setStoredDefaultApplied] = useState(false);

  useEffect(() => {
    async function loadRealms() {
      try {
        setLoading(true);

        const response = await axios.get<RealmsResponse>(
          `${API_BASE_URL}/realms`
        );

        if (
          response.data.status === "Success" &&
          response.data.items.length > 0
        ) {
          setRealms(response.data.items);
        }
      } catch {
        setRealms(FALLBACK_REALMS);
      } finally {
        setLoading(false);
        setRealmsLoaded(true);
      }
    }

    loadRealms();
  }, []);

  const expandedRealmOptions = useMemo(() => {
    return expandRealms(realms);
  }, [realms]);

  useEffect(() => {
    if (!realmsLoaded || expandedRealmOptions.length === 0) {
      return;
    }

    if (!storedDefaultApplied) {
      const storedSelection = readStoredRealmSelection();

      if (storedSelection) {
        const storedOption =
          expandedRealmOptions.find(
            (option) => option.option_id === storedSelection.option_id
          ) ??
          expandedRealmOptions.find(
            (option) =>
              option.connected_realm_id ===
                storedSelection.connected_realm_id &&
              option.realm_name === storedSelection.realm_name
          ) ??
          expandedRealmOptions.find(
            (option) =>
              option.connected_realm_id === storedSelection.connected_realm_id
          );

        if (storedOption) {
          setSelectedOptionId(storedOption.option_id);

          if (storedOption.connected_realm_id !== value) {
            onChange(storedOption.connected_realm_id);
          }

          setStoredDefaultApplied(true);
          return;
        }
      }

      setStoredDefaultApplied(true);
    }

    const currentSelectedOption = expandedRealmOptions.find(
      (option) => option.option_id === selectedOptionId
    );

    if (
      currentSelectedOption &&
      currentSelectedOption.connected_realm_id === value
    ) {
      return;
    }

    const firstMatchingOption = expandedRealmOptions.find(
      (option) => option.connected_realm_id === value
    );

    if (firstMatchingOption) {
      setSelectedOptionId(firstMatchingOption.option_id);
      return;
    }

    setSelectedOptionId(expandedRealmOptions[0].option_id);
  }, [
    expandedRealmOptions,
    onChange,
    realmsLoaded,
    selectedOptionId,
    storedDefaultApplied,
    value,
  ]);

  const selectedRealmTitle = useMemo(() => {
    const selectedRealm = expandedRealmOptions.find(
      (option) => option.option_id === selectedOptionId
    );

    if (!selectedRealm) {
      return loading ? "Loading realms..." : "Select connected realm";
    }

    return getFullRealmTitle(selectedRealm);
  }, [expandedRealmOptions, selectedOptionId, loading]);

  function handleRealmChange(optionId: string) {
    setSelectedOptionId(optionId);

    const selectedRealm = expandedRealmOptions.find(
      (option) => option.option_id === optionId
    );

    if (selectedRealm) {
      saveStoredRealmSelection(selectedRealm);
      onChange(selectedRealm.connected_realm_id);
    }
  }

  return (
    <select
      value={selectedOptionId}
      onChange={(event) => handleRealmChange(event.target.value)}
      className="max-w-sm rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none transition hover:border-slate-600 focus:border-amber-500"
      title={selectedRealmTitle}
    >
      {expandedRealmOptions.map((realm) => (
        <option
          key={realm.option_id}
          value={realm.option_id}
          title={getFullRealmTitle(realm)}
        >
          {getDropdownLabel(realm)}
        </option>
      ))}
    </select>
  );
}