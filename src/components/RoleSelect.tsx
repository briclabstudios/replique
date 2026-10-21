import { setMyRole } from '../lib/storage'

/** Choix de mon rôle pour une pièce, mémorisé sur cet appareil. */
export function RoleSelect({ playId, characters, value, onChange }: {
  playId: string
  characters: { id: string; name: string }[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  return (
    <label className="role-select">
      Mon rôle
      <select
        value={value ?? ''}
        onChange={(e) => {
          const id = e.target.value || null
          setMyRole(playId, id)
          onChange(id)
        }}
      >
        <option value="">— Aucun (tout est lu) —</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}
