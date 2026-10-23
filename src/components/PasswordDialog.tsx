import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'

// Simple garde-fou contre les actions involontaires (mode payant, suppression) : il est visible dans le code publié
const ACTION_PASSWORD = '654321'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function PasswordDialog({ title, message, confirmLabel = 'Valider', danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password === ACTION_PASSWORD) onConfirm()
    else {
      setWrong(true)
      setPassword('')
    }
  }

  return (
    // Échap ferme la fenêtre : on l'interprète comme une annulation
    <dialog ref={ref} className="modal" onCancel={onCancel} aria-labelledby="password-title">
      <form onSubmit={submit}>
        <h2 id="password-title">
          <Lock size={18} aria-hidden /> {title}
        </h2>
        <p className="muted">{message}</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setWrong(false)
          }}
          aria-label="Mot de passe"
          aria-invalid={wrong}
        />
        {wrong && <p className="error">Mot de passe incorrect.</p>}
        <div className="row modal-actions">
          <button type="button" className="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className={danger ? 'button danger' : 'button primary'} disabled={!password}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
