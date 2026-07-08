type Realm = {
  id: number;
  name: string;
};

type RealmSelectorProps = {
  selectedRealm: number;
  onRealmChange: (realmId: number) => void;
};

const WOW_REALMS: Realm[] = [
  { id: 11, name: "US - Illidan" },
  { id: 4, name: "US - Area 52" },
  { id: 12, name: "US - Sargeras" },
  { id: 53, name: "US - Tichondrius" },
];

export default function RealmSelector({
  selectedRealm,
  onRealmChange,
}: RealmSelectorProps) {
  return (
    <select
      value={selectedRealm}
      onChange={(event) => onRealmChange(Number(event.target.value))}
      className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none transition hover:border-slate-600 focus:border-amber-500"
    >
      {WOW_REALMS.map((realm) => (
        <option key={realm.id} value={realm.id}>
          {realm.name}
        </option>
      ))}
    </select>
  );
}