import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Upload } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { uploadAvatar } from '../lib/avatar'
import { BOARD_COLORS } from '../store/boardsStore'

export default function SettingsPage() {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [birthday, setBirthday] = useState(profile?.birthday ?? '')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name)
      setUsername(profile.username)
      setBirthday(profile.birthday ?? '')
    }
  }, [profile])

  if (!profile || !user) return null

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)
    setSavingProfile(true)
    const err = await updateProfile({
      display_name: displayName.trim(),
      username: username.trim(),
      birthday: birthday || null,
    })
    setSavingProfile(false)
    if (err) setProfileError(err)
    else setProfileSuccess('Profil gespeichert')
  }

  async function handleAvatarFile(file: File | null) {
    if (!file || !user) return
    setAvatarError(null)
    setUploadingAvatar(true)
    const { url, error } = await uploadAvatar(user.id, file)
    if (error || !url) {
      setAvatarError(error ?? 'Fehler beim Hochladen')
      setUploadingAvatar(false)
      return
    }
    const updateErr = await updateProfile({ avatar_url: url })
    setUploadingAvatar(false)
    if (updateErr) setAvatarError(updateErr)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleColorChange(color: string) {
    await updateProfile({ avatar_color: color })
  }

  async function handleRemoveAvatar() {
    setAvatarError(null)
    const err = await updateProfile({ avatar_url: null })
    if (err) setAvatarError(err)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)
    if (newPassword.length < 6) {
      setPasswordError('Passwort muss mindestens 6 Zeichen lang sein')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwörter stimmen nicht überein')
      return
    }
    setSavingPassword(true)
    const err = await updatePassword(newPassword)
    setSavingPassword(false)
    if (err) {
      setPasswordError(err)
    } else {
      setPasswordSuccess('Passwort geändert')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <h2 className="mb-3 text-sm font-semibold">Profilbild</h2>
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Profilbild" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: profile.avatar_color }}
            >
              {profile.display_name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-60 dark:bg-racing-800 dark:text-racing-100"
              >
                <Upload size={14} />
                {uploadingAvatar ? 'Lädt hoch…' : 'Bild hochladen'}
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                >
                  Entfernen
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {!profile.avatar_url && (
              <div className="flex flex-wrap gap-2">
                {BOARD_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className={`h-6 w-6 rounded-full border-2 ${profile.avatar_color === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        {avatarError && <p className="mt-2 text-sm text-red-500">{avatarError}</p>}
      </div>

      <form
        onSubmit={handleProfileSubmit}
        className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900"
      >
        <h2 className="text-sm font-semibold">Profil</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Anzeigename</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Benutzername</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Geburtsdatum</label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">E-Mail</label>
          <input
            disabled
            value={user.email ?? ''}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-400 dark:border-racing-700"
          />
        </div>
        {profileError && <p className="text-sm text-red-500">{profileError}</p>}
        {profileSuccess && <p className="text-sm text-emerald-500">{profileSuccess}</p>}
        <button
          type="submit"
          disabled={savingProfile}
          className="mt-1 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {savingProfile ? 'Speichere…' : 'Speichern'}
        </button>
      </form>

      <form
        onSubmit={handlePasswordSubmit}
        className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900"
      >
        <h2 className="text-sm font-semibold">Passwort ändern</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Neues Passwort</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 pr-9 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Neues Passwort bestätigen</label>
          <input
            type={showPassword ? 'text' : 'password'}
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
        {passwordSuccess && <p className="text-sm text-emerald-500">{passwordSuccess}</p>}
        <button
          type="submit"
          disabled={savingPassword}
          className="mt-1 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {savingPassword ? 'Speichere…' : 'Passwort ändern'}
        </button>
      </form>
    </div>
  )
}
