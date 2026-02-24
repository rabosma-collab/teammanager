'use client';

import React, { useState, useEffect, useRef } from 'react';
import DraggableModal from './DraggableModal';
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

      // Avatar centraal: eerst uit user_metadata, daarna fallback naar player record
      const centralAvatar = user.user_metadata?.avatar_url ?? null;
      setAvatarUrl(centralAvatar);

      if (currentPlayerId) {
        const { data } = await supabase
          .from('players')
          .select('name, avatar_url')
          .eq('id', currentPlayerId)
          .single();

        if (data) {
          setName(data.name ?? '');
          // Gebruik player avatar alleen als fallback wanneer central nog niet gezet
          if (!centralAvatar && data.avatar_url) setAvatarUrl(data.avatar_url);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (avatarUrl) {
      const match = avatarUrl.match(/\/avatars\/(.+?)(\?|$)/);
      if (match) await supabase.storage.from('avatars').remove([match[1]]);
    }

    // Verwijder centraal
    await supabase.auth.updateUser({ data: { avatar_url: null } });

    // Sync naar alle gekoppelde spelers
    await syncAvatarToPlayers(user.id, null);

    setAvatarUrl(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    onPlayerUpdated();
  };

  const syncAvatarToPlayers = async (userId: string, url: string | null) => {
    const { data: members } = await supabase
      .from('team_members')
      .select('player_id')
      .eq('user_id', userId)
      .not('player_id', 'is', null);

    if (members?.length) {
      const ids = members.map((m: { player_id: number | null }) => m.player_id).filter(Boolean);
      if (ids.length) {
        await supabase.from('players').update({ avatar_url: url }).in('id', ids);
      }
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (currentPlayerId) {
      if (trimmedName.length < 2) {
        setMessage({ text: 'Naam moet minimaal 2 tekens zijn.', error: true });
        return;
      }
      if (trimmedName.length > 50) {
        setMessage({ text: 'Naam mag maximaal 50 tekens zijn.', error: true });
        return;
      }
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setMessage({ text: 'Vul een geldig emailadres in.', error: true });
        return;
      }
    }
    if (newPassword && newPassword.length < 6) {
      setMessage({ text: 'Wachtwoord moet minimaal 6 tekens zijn.', error: true });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');

      let newAvatarUrl = avatarUrl;

      // 1. Upload avatar als nieuw bestand geselecteerd
      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() ?? 'jpg';
        const path = `users/${user.id}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, selectedFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        newAvatarUrl = `${publicUrl}?t=${Date.now()}`;
      }

      // 2. Sla centraal op in user_metadata — alleen als er een nieuwe foto geselecteerd is
      //    (verwijderen gaat via handleRemoveAvatar; nooit null overschrijven bij gewoon opslaan)
      if (selectedFile) {
        await supabase.auth.updateUser({ data: { avatar_url: newAvatarUrl } });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setSelectedFile(null);
        setAvatarUrl(newAvatarUrl);

        // 3. Sync naar alle gekoppelde spelers
        await syncAvatarToPlayers(user.id, newAvatarUrl);
      }

      // 4. Spelersnaam opslaan
      if (currentPlayerId) {
        const playerUpdate: { name: string; avatar_url?: string | null } = { name: trimmedName };
        if (selectedFile) playerUpdate.avatar_url = newAvatarUrl;
        const { error: playerError } = await supabase
          .from('players')
          .update(playerUpdate)
          .eq('id', currentPlayerId);
        if (playerError) throw playerError;
      }

      onPlayerUpdated();

      // 5. Email wijzigen
      if (trimmedEmail && trimmedEmail !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (emailError) throw emailError;
        setMessage({ text: 'Profiel opgeslagen. Controleer je inbox om het nieuwe emailadres te bevestigen.', error: false });
        setSaving(false);
        return;
      }

      // 6. Wachtwoord wijzigen
      if (newPassword) {
        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwError) throw pwError;
        setNewPassword('');
      }

      setMessage({ text: 'Profiel opgeslagen!', error: false });
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
    <DraggableModal onClose={onClose} className="w-[calc(100vw-2rem)] max-w-md">
      <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-2.5rem)]">
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

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

          {displayUrl && !previewUrl && (
            <button type="button" onClick={handleRemoveAvatar} className="mt-2 text-xs text-red-400 hover:text-red-300 underline">
              Foto verwijderen
            </button>
          )}
          {previewUrl && (
            <p className="mt-2 text-xs text-yellow-400">Nieuwe foto geselecteerd — sla op om te bevestigen</p>
          )}
          {!displayUrl && (
            <p className="mt-2 text-xs text-gray-500">Klik op de cirkel om een foto toe te voegen</p>
          )}
          <p className="mt-1 text-xs text-gray-600">Profielfoto geldt voor al je teams</p>
        </div>

        <div className="space-y-4">
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

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>

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
    </DraggableModal>
  );
}
