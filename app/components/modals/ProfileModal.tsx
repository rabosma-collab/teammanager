'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useTeamContext } from '../../contexts/TeamContext';

interface ProfileModalProps {
  onClose: () => void;
  onPlayerUpdated: () => void;
  welcomeMode?: boolean;
}

export default function ProfileModal({ onClose, onPlayerUpdated, welcomeMode = false }: ProfileModalProps) {
  const { currentPlayerId } = useTeamContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isGoogle, setIsGoogle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? '');
      setIsGoogle(user.app_metadata?.provider === 'google');

      if (currentPlayerId) {
        const { data } = await supabase
          .from('players')
          .select('name, avatar_url')
          .eq('id', currentPlayerId)
          .single();

        if (data) {
          setName(data.name ?? '');
          setAvatarUrl(data.avatar_url ?? null);
        }
      }
    };

    load();
  }, [currentPlayerId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Kies een afbeelding (jpg, png, webp, etc.)', error: true });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: 'Afbeelding mag maximaal 5 MB zijn', error: true });
      return;
    }

    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setMessage(null);
  };

  const handleRemoveAvatar = async () => {
    if (!currentPlayerId) return;

    if (avatarUrl) {
      // Extract path after the bucket name in the URL
      const match = avatarUrl.match(/\/avatars\/(.+)$/);
      if (match) {
        await supabase.storage.from('avatars').remove([match[1]]);
      }
    }

    await supabase.from('players').update({ avatar_url: null }).eq('id', currentPlayerId);
    setAvatarUrl(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    onPlayerUpdated();
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      let newAvatarUrl = avatarUrl;

      // 1. Upload avatar als er een nieuw bestand is geselecteerd
      if (selectedFile && currentPlayerId) {
        const ext = selectedFile.name.split('.').pop() ?? 'jpg';
        const path = `${currentPlayerId}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, selectedFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(path);

        newAvatarUrl = `${publicUrl}?t=${Date.now()}`;
      }

      // 2. Spelersnaam en avatar opslaan
      if (currentPlayerId) {
        const { error: playerError } = await supabase
          .from('players')
          .update({ name: name.trim(), avatar_url: newAvatarUrl })
          .eq('id', currentPlayerId);

        if (playerError) throw playerError;

        setAvatarUrl(newAvatarUrl);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setSelectedFile(null);
        onPlayerUpdated();
      }

      // 3. Email wijzigen als aangepast
      const { data: { user } } = await supabase.auth.getUser();
      if (user && email.trim() && email.trim() !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) throw emailError;
        setMessage({ text: 'Profiel opgeslagen. Controleer je inbox om het nieuwe emailadres te bevestigen.', error: false });
      }

      // 4. Wachtwoord wijzigen als ingevuld
      if (newPassword) {
        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwError) throw pwError;
        setNewPassword('');
      }

      if (!message) {
        setMessage({ text: 'Profiel opgeslagen!', error: false });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Onbekende fout';
      setMessage({ text: `Fout: ${msg}`, error: true });
    } finally {
      setSaving(false);
    }
  };

  const displayUrl = previewUrl ?? avatarUrl;
  const initials = name ? name.substring(0, 2).toUpperCase() : '?';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-md my-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            {welcomeMode && (
              <p className="text-xs text-yellow-400 font-semibold mb-0.5">Welkom bij het team!</p>
            )}
            <h2 className="text-lg sm:text-xl font-bold">
              {welcomeMode ? 'Stel je profiel in' : 'Mijn profiel'}
            </h2>
          </div>
          <button onClick={onClose} className="text-2xl hover:text-red-500 p-2">✕</button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-yellow-500 hover:border-yellow-300 transition-colors group focus:outline-none"
          >
            {displayUrl ? (
              <img src={displayUrl} alt="Profielfoto" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-yellow-500 flex items-center justify-center">
                <span className="text-black font-black text-2xl">{initials}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-xs font-bold text-center leading-tight">Foto<br />uploaden</span>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {displayUrl && !previewUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
            >
              Foto verwijderen
            </button>
          )}
          {previewUrl && (
            <p className="mt-2 text-xs text-yellow-400">Nieuwe foto geselecteerd — sla op om te bevestigen</p>
          )}
          {!displayUrl && (
            <p className="mt-2 text-xs text-gray-500">Klik op de cirkel om een foto toe te voegen</p>
          )}
        </div>

        <div className="space-y-4">
          {/* Naam — alleen als speler gekoppeld */}
          {currentPlayerId && (
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-1">Naam</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>

          {/* Wachtwoord — niet tonen bij Google OAuth */}
          {!isGoogle && (
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-1">Nieuw wachtwoord</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leeg laten om niet te wijzigen"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
            </div>
          )}

          {/* Terugkoppeling */}
          {message && (
            <div className={`text-sm p-3 rounded ${message.error ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-bold text-sm"
            >
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-gray-600 hover:bg-gray-700 rounded font-bold text-sm"
            >
              Sluiten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
