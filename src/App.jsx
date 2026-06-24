import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const emptyCharacter = {
  name: '',
  role: '',
  personality: '',
  visual_notes: '',
}

const navigationTabs = [
  { id: 'inbox', label: 'Rak Ide' },
  { id: 'characters', label: 'Character Board' },
  { id: 'relationships', label: 'Relationship Map' },
  { id: 'story', label: 'Rak Cerita' },
]

function formatDate(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function isCharacterIncomplete(character) {
  return ['role', 'personality', 'visual_notes'].some(
    (field) => !character[field]?.trim(),
  )
}

function getCharacterDisplayName(character) {
  return character?.name?.trim() || '(belum diberi nama)'
}

function buildCircularLayout(characters) {
  const centerX = 360
  const centerY = 220
  const radius = characters.length <= 2 ? 130 : 160

  if (characters.length === 1) {
    return {
      [characters[0].id]: {
        x: centerX,
        y: centerY,
        name: getCharacterDisplayName(characters[0]),
      },
    }
  }

  return characters.reduce((positions, character, index) => {
    const angle = (index / characters.length) * Math.PI * 2 - Math.PI / 2

    positions[character.id] = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      name: getCharacterDisplayName(character),
    }

    return positions
  }, {})
}

function Inbox({ characters, inboxItems, onRefresh, onError }) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [linkSelections, setLinkSelections] = useState({})
  const [busyItemId, setBusyItemId] = useState(null)

  async function addInboxItem(event) {
    event.preventDefault()

    const trimmedContent = content.trim()
    if (!trimmedContent) return

    setIsSubmitting(true)
    const { error } = await supabase
      .from('inbox_items')
      .insert({ content: trimmedContent })

    if (error) {
      onError(error.message)
    } else {
      setContent('')
      await onRefresh()
    }

    setIsSubmitting(false)
  }

  async function deleteInboxItem(id) {
    setBusyItemId(id)
    const { error } = await supabase.from('inbox_items').delete().eq('id', id)

    if (error) {
      onError(error.message)
    } else {
      await onRefresh()
    }

    setBusyItemId(null)
  }

  async function linkToCharacter(itemId) {
    const characterId = linkSelections[itemId]
    if (!characterId) return

    setBusyItemId(itemId)
    const { error } = await supabase
      .from('inbox_items')
      .update({ linked_to: characterId })
      .eq('id', itemId)

    if (error) {
      onError(error.message)
    } else {
      await onRefresh()
    }

    setBusyItemId(null)
  }

  function getCharacterName(id) {
    const character = characters.find((item) => item.id === id)
    return character?.name?.trim() || 'Karakter tanpa nama'
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Rak Ide</h2>
          <p>Simpan ide mentah, lalu tempelkan ke karakter saat sudah cocok.</p>
        </div>
      </div>

      <form className="inbox-form" onSubmit={addInboxItem}>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Tulis ide, dialog, konflik, atau detail kecil..."
          rows={5}
        />
        <button type="submit" disabled={isSubmitting || !content.trim()}>
          {isSubmitting ? 'Menambah...' : 'Tambah'}
        </button>
      </form>

      <div className="item-list">
        {inboxItems.length === 0 ? (
          <p className="empty-state">Belum ada ide di rak.</p>
        ) : (
          inboxItems.map((item) => (
            <article className="inbox-item" key={item.id}>
              <div>
                <p className="item-content">{item.content}</p>
                <p className="meta">
                  {formatDate(item.created_at)}
                  {item.linked_to ? ` - ${getCharacterName(item.linked_to)}` : ''}
                </p>
              </div>
              <div className="item-actions">
                <select
                  value={linkSelections[item.id] || item.linked_to || ''}
                  onChange={(event) =>
                    setLinkSelections((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                >
                  <option value="">Pilih karakter</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name?.trim() || 'Karakter tanpa nama'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => linkToCharacter(item.id)}
                  disabled={busyItemId === item.id || characters.length === 0}
                >
                  Tempelkan ke karakter
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => deleteInboxItem(item.id)}
                  disabled={busyItemId === item.id}
                >
                  Hapus
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function CharacterBoard({
  characters,
  inboxItems,
  onAddCharacter,
  onUpdateCharacter,
  onUnlinkInboxItem,
  saveStatus,
}) {
  const [expandedCharacterKey, setExpandedCharacterKey] = useState(null)

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Character Board</h2>
          <p>Bangun daftar karakter dan lengkapi detailnya sedikit demi sedikit.</p>
        </div>
        <button type="button" onClick={onAddCharacter}>
          Tambah karakter baru
        </button>
      </div>

      {characters.length === 0 ? (
        <p className="empty-state">Belum ada karakter.</p>
      ) : (
        <div className="character-grid">
          {characters.map((character, index) => {
            const characterKey = character.id || `character-${index}`
            const isExpanded = expandedCharacterKey === characterKey
            const incomplete = isCharacterIncomplete(character)

            return (
              <article
                className={`character-card ${incomplete ? 'incomplete' : ''}`}
                key={characterKey}
              >
                <button
                  type="button"
                  className="card-summary"
                  onClick={() =>
                    setExpandedCharacterKey((current) =>
                      current === characterKey ? null : characterKey,
                    )
                  }
                >
                  <span>
                    <strong>{character.name?.trim() || 'Karakter tanpa nama'}</strong>
                    <small>{character.role?.trim() || 'Role belum diisi'}</small>
                  </span>
                  {incomplete && <span className="badge">Belum lengkap</span>}
                </button>

                {isExpanded && (
                  <div className="character-form">
                    <label>
                      Nama
                      <input
                        value={character.name || ''}
                        onChange={(event) =>
                          onUpdateCharacter(character.id, 'name', event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Role
                      <input
                        value={character.role || ''}
                        onChange={(event) =>
                          onUpdateCharacter(character.id, 'role', event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Personality
                      <textarea
                        value={character.personality || ''}
                        onChange={(event) =>
                          onUpdateCharacter(
                            character.id,
                            'personality',
                            event.target.value,
                          )
                        }
                        rows={4}
                      />
                    </label>
                    <label>
                      Visual notes
                      <textarea
                        value={character.visual_notes || ''}
                        onChange={(event) =>
                          onUpdateCharacter(
                            character.id,
                            'visual_notes',
                            event.target.value,
                          )
                        }
                        rows={4}
                      />
                    </label>
                    <div className="related-ideas">
                      <h3>Ide terkait</h3>
                      {inboxItems.filter((item) => item.linked_to === character.id)
                        .length === 0 ? (
                        <p className="related-placeholder">
                          Belum ada ide yang ditempel
                        </p>
                      ) : (
                        <div className="related-list">
                          {inboxItems
                            .filter((item) => item.linked_to === character.id)
                            .map((item) => (
                              <article className="related-item" key={item.id}>
                                <p>{item.content}</p>
                                <button
                                  type="button"
                                  className="small-button"
                                  onClick={() => onUnlinkInboxItem(item.id)}
                                >
                                  Lepas
                                </button>
                              </article>
                            ))}
                        </div>
                      )}
                    </div>
                    <p className="save-status">
                      {saveStatus[character.id] || 'Perubahan tersimpan otomatis'}
                    </p>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function RelationshipMap({
  characters,
  relationships,
  onAddRelationship,
  onDeleteRelationship,
}) {
  const [characterA, setCharacterA] = useState('')
  const [characterB, setCharacterB] = useState('')
  const [relationType, setRelationType] = useState('')
  const [busyRelationshipId, setBusyRelationshipId] = useState(null)
  const positions = buildCircularLayout(characters)

  function getCharacterName(id) {
    const character = characters.find((item) => item.id === id)
    return getCharacterDisplayName(character)
  }

  async function submitRelationship(event) {
    event.preventDefault()

    if (!characterA || !characterB || !relationType.trim()) return

    await onAddRelationship({
      character_a: characterA,
      character_b: characterB,
      relation_type: relationType.trim(),
    })

    setCharacterA('')
    setCharacterB('')
    setRelationType('')
  }

  async function deleteRelationship(id) {
    setBusyRelationshipId(id)
    await onDeleteRelationship(id)
    setBusyRelationshipId(null)
  }

  return (
    <section className="panel relationship-panel">
      <div className="section-heading">
        <div>
          <h2>Relationship Map</h2>
          <p>Catat relasi antar karakter dan lihat petanya.</p>
        </div>
      </div>

      <form className="relationship-form" onSubmit={submitRelationship}>
        <label>
          Karakter A
          <select
            value={characterA}
            onChange={(event) => setCharacterA(event.target.value)}
          >
            <option value="">Pilih karakter</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {getCharacterDisplayName(character)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Karakter B
          <select
            value={characterB}
            onChange={(event) => setCharacterB(event.target.value)}
          >
            <option value="">Pilih karakter</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {getCharacterDisplayName(character)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jenis relasi
          <input
            value={relationType}
            onChange={(event) => setRelationType(event.target.value)}
            placeholder="menyukai, sahabat, guru, rival..."
          />
        </label>
        <button
          type="submit"
          disabled={
            !characterA ||
            !characterB ||
            characterA === characterB ||
            !relationType.trim()
          }
        >
          Tambah relasi
        </button>
      </form>

      <div className="relationship-list">
        {relationships.length === 0 ? (
          <p className="empty-state">Belum ada relasi.</p>
        ) : (
          relationships.map((relationship) => (
            <article className="relationship-row" key={relationship.id}>
              <span>
                {getCharacterName(relationship.character_a)} -{' '}
                {relationship.relation_type || 'relasi'} -{' '}
                {getCharacterName(relationship.character_b)}
              </span>
              <button
                type="button"
                className="danger-button small-button"
                onClick={() => deleteRelationship(relationship.id)}
                disabled={busyRelationshipId === relationship.id}
              >
                Hapus
              </button>
            </article>
          ))
        )}
      </div>

      <section className="map-section">
        <h3>Visualisasi peta relasi</h3>
        {characters.length === 0 ? (
          <p className="empty-state">Tambahkan karakter untuk mulai membuat peta.</p>
        ) : (
          <svg className="relationship-canvas" viewBox="0 0 720 440" role="img">
            <title>Peta relasi karakter</title>
            {relationships.map((relationship) => {
              const source = positions[relationship.character_a]
              const target = positions[relationship.character_b]
              if (!source || !target) return null

              const labelX = (source.x + target.x) / 2
              const labelY = (source.y + target.y) / 2

              return (
                <g key={relationship.id}>
                  <line
                    className="relationship-line"
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                  <rect
                    className="relationship-label-bg"
                    x={labelX - 52}
                    y={labelY - 15}
                    width="104"
                    height="30"
                    rx="6"
                  />
                  <text
                    className="relationship-label"
                    x={labelX}
                    y={labelY + 4}
                    textAnchor="middle"
                  >
                    {relationship.relation_type || 'relasi'}
                  </text>
                </g>
              )
            })}
            {characters.map((character) => {
              const position = positions[character.id]

              return (
                <g className="relationship-node" key={character.id}>
                  <rect
                    x={position.x - 72}
                    y={position.y - 26}
                    width="144"
                    height="52"
                    rx="10"
                  />
                  <text x={position.x} y={position.y + 5} textAnchor="middle">
                    {position.name}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </section>
    </section>
  )
}

function StoryBoard({
  characters,
  storyFragments,
  fragmentCharacters,
  onAddFragment,
  onDeleteFragment,
  onAttachFragmentCharacter,
  onDetachFragmentCharacter,
  onMoveFragment,
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedFormCharacterIds, setSelectedFormCharacterIds] = useState([])
  const [isFormPickerOpen, setIsFormPickerOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [openPickerId, setOpenPickerId] = useState(null)
  const [busyFragmentId, setBusyFragmentId] = useState(null)
  const boardRef = useRef(null)

  useEffect(() => {
    function closePickerOnOutsideClick(event) {
      if (!boardRef.current?.contains(event.target)) {
        setOpenPickerId(null)
        setIsFormPickerOpen(false)
      }
    }

    document.addEventListener('pointerdown', closePickerOnOutsideClick)

    return () => {
      document.removeEventListener('pointerdown', closePickerOnOutsideClick)
    }
  }, [])

  async function submitFragment(event) {
    event.preventDefault()

    if (!title.trim() && !content.trim()) return

    await onAddFragment({
      title: title.trim() || 'Potongan tanpa judul',
      content: content.trim(),
      characterIds: selectedFormCharacterIds,
    })

    setTitle('')
    setContent('')
    setSelectedFormCharacterIds([])
    setIsFormPickerOpen(false)
  }

  function getLinkedCharacterIds(fragmentId) {
    return fragmentCharacters
      .filter((item) => item.fragment_id === fragmentId)
      .map((item) => item.character_id)
  }

  function getCharacterName(id) {
    const character = characters.find((item) => item.id === id)
    return getCharacterDisplayName(character)
  }

  async function toggleFragmentCharacter(fragmentId, characterId, isChecked) {
    setBusyFragmentId(fragmentId)

    if (isChecked) {
      await onAttachFragmentCharacter(fragmentId, characterId)
    } else {
      await onDetachFragmentCharacter(fragmentId, characterId)
    }

    setBusyFragmentId(null)
  }

  function toggleFormCharacter(characterId, isChecked) {
    setSelectedFormCharacterIds((current) => {
      if (isChecked) {
        return current.includes(characterId) ? current : [...current, characterId]
      }

      return current.filter((id) => id !== characterId)
    })
  }

  async function moveFragment(fragmentId, direction) {
    setBusyFragmentId(fragmentId)
    await onMoveFragment(fragmentId, direction)
    setBusyFragmentId(null)
  }

  async function deleteFragment(fragmentId) {
    setBusyFragmentId(fragmentId)
    await onDeleteFragment(fragmentId)
    setBusyFragmentId(null)
  }

  return (
    <section className="panel storyboard-panel" ref={boardRef}>
      <div className="section-heading">
        <div>
          <h2>Rak Cerita</h2>
          <p>Susun potongan cerita lepas sebelum dirapikan menjadi alur final.</p>
        </div>
      </div>

      <form className="story-form" onSubmit={submitFragment}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Judul"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Isi/catatan"
          rows={4}
        />
        <div className="character-picker">
          <button
            type="button"
            className="character-picker-trigger"
            onClick={() => setIsFormPickerOpen((current) => !current)}
          >
            {selectedFormCharacterIds.length === 0
              ? '+ Pilih karakter'
              : `${selectedFormCharacterIds.length} karakter terpilih`}
          </button>

          {isFormPickerOpen && (
            <div className="checkbox-popover">
              {characters.length === 0 ? (
                <p className="empty-state">Belum ada karakter untuk dipilih.</p>
              ) : (
                <div className="checkbox-list">
                  {characters.map((character) => {
                    const isChecked = selectedFormCharacterIds.includes(
                      character.id,
                    )

                    return (
                      <label className="checkbox-option" key={character.id}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) =>
                            toggleFormCharacter(character.id, event.target.checked)
                          }
                        />
                        <span>{getCharacterDisplayName(character)}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="fragment-badges">
            {selectedFormCharacterIds.length === 0 ? (
              <span className="muted-badge">Belum ada karakter</span>
            ) : (
              selectedFormCharacterIds.map((characterId) => (
                <span className="character-badge" key={characterId}>
                  {getCharacterName(characterId)}
                </span>
              ))
            )}
          </div>
        </div>
        <button type="submit" disabled={!title.trim() && !content.trim()}>
          Tambah
        </button>
      </form>

      {storyFragments.length === 0 ? (
        <p className="empty-state">Belum ada potongan cerita.</p>
      ) : (
        <div className="story-list">
          {storyFragments.map((fragment, index) => {
            const linkedCharacterIds = getLinkedCharacterIds(fragment.id)
            const isExpanded = expandedId === fragment.id
            const visibleContent =
              isExpanded || fragment.content.length <= 180
                ? fragment.content
                : `${fragment.content.slice(0, 180)}...`

            return (
              <article className="story-card" key={fragment.id}>
                <button
                  type="button"
                  className="story-summary"
                  onClick={() =>
                    setExpandedId((current) =>
                      current === fragment.id ? null : fragment.id,
                    )
                  }
                >
                  <span>
                    <strong>{fragment.title || 'Potongan tanpa judul'}</strong>
                    <small>Urutan {fragment.order_index}</small>
                  </span>
                </button>

                <p className="story-content">
                  {visibleContent || 'Belum ada isi/catatan.'}
                </p>

                <div className="character-picker">
                  <button
                    type="button"
                    className="character-picker-trigger"
                    onClick={() =>
                      setOpenPickerId((current) =>
                        current === fragment.id ? null : fragment.id,
                      )
                    }
                  >
                    {linkedCharacterIds.length === 0
                      ? '+ Pilih karakter'
                      : `${linkedCharacterIds.length} karakter terpilih`}
                  </button>

                  {openPickerId === fragment.id && (
                    <div className="checkbox-popover">
                      {characters.length === 0 ? (
                        <p className="empty-state">
                          Belum ada karakter untuk dipilih.
                        </p>
                      ) : (
                        <div className="checkbox-list">
                          {characters.map((character) => {
                            const isChecked = linkedCharacterIds.includes(
                              character.id,
                            )

                            return (
                              <label
                                className="checkbox-option"
                                key={character.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(event) =>
                                    toggleFragmentCharacter(
                                      fragment.id,
                                      character.id,
                                      event.target.checked,
                                    )
                                  }
                                  disabled={busyFragmentId === fragment.id}
                                />
                                <span>{getCharacterDisplayName(character)}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="fragment-badges">
                    {linkedCharacterIds.length === 0 ? (
                      <span className="muted-badge">Belum ada karakter</span>
                    ) : (
                      linkedCharacterIds.map((characterId) => (
                        <span className="character-badge" key={characterId}>
                          {getCharacterName(characterId)}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="story-actions">
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => moveFragment(fragment.id, 'up')}
                    disabled={index === 0 || busyFragmentId === fragment.id}
                  >
                    Atas
                  </button>
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => moveFragment(fragment.id, 'down')}
                    disabled={
                      index === storyFragments.length - 1 ||
                      busyFragmentId === fragment.id
                    }
                  >
                    Bawah
                  </button>
                  <button
                    type="button"
                    className="danger-button small-button"
                    onClick={() => deleteFragment(fragment.id)}
                    disabled={busyFragmentId === fragment.id}
                  >
                    Hapus
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function App() {
  const [characters, setCharacters] = useState([])
  const [inboxItems, setInboxItems] = useState([])
  const [relationships, setRelationships] = useState([])
  const [storyFragments, setStoryFragments] = useState([])
  const [fragmentCharacters, setFragmentCharacters] = useState([])
  const [activeTab, setActiveTab] = useState('inbox')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [saveStatus, setSaveStatus] = useState({})
  const saveTimers = useRef(new Map())

  const loadCharacters = useCallback(async () => {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setCharacters(data || [])
  }, [])

  const loadInboxItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('inbox_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setInboxItems(data || [])
  }, [])

  const loadRelationships = useCallback(async () => {
    const { data, error } = await supabase
      .from('relationships')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setRelationships(data || [])
  }, [])

  const loadStoryFragments = useCallback(async () => {
    const { data, error } = await supabase
      .from('story_fragments')
      .select('*')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setStoryFragments(data || [])
  }, [])

  const loadFragmentCharacters = useCallback(async () => {
    const { data, error } = await supabase
      .from('fragment_characters')
      .select('*')

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setFragmentCharacters(data || [])
  }, [])

  const loadData = useCallback(async () => {
    await Promise.all([
      loadCharacters(),
      loadInboxItems(),
      loadRelationships(),
      loadStoryFragments(),
      loadFragmentCharacters(),
    ])
    setIsLoading(false)
  }, [
    loadCharacters,
    loadInboxItems,
    loadRelationships,
    loadStoryFragments,
    loadFragmentCharacters,
  ])

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadData()
    }, 0)

    return () => clearTimeout(initialLoad)
  }, [loadData])

  useEffect(() => {
    const timers = saveTimers.current

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  async function addCharacter() {
    const { data, error } = await supabase
      .from('characters')
      .insert(emptyCharacter)
      .select()
      .single()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setCharacters((current) => [data, ...current])
  }

  function scheduleCharacterSave(character) {
    const currentTimer = saveTimers.current.get(character.id)
    if (currentTimer) clearTimeout(currentTimer)

    setSaveStatus((current) => ({
      ...current,
      [character.id]: 'Menunggu auto-save...',
    }))

    const timer = setTimeout(async () => {
      setSaveStatus((current) => ({
        ...current,
        [character.id]: 'Menyimpan...',
      }))

      const { error } = await supabase
        .from('characters')
        .update({
          name: character.name,
          role: character.role,
          personality: character.personality,
          visual_notes: character.visual_notes,
        })
        .eq('id', character.id)

      if (error) {
        setErrorMessage(error.message)
        setSaveStatus((current) => ({
          ...current,
          [character.id]: 'Gagal menyimpan',
        }))
      } else {
        setSaveStatus((current) => ({
          ...current,
          [character.id]: 'Tersimpan',
        }))
      }
    }, 800)

    saveTimers.current.set(character.id, timer)
  }

  function updateCharacterField(id, field, value) {
    const character = characters.find((item) => item.id === id)
    if (!character) return

    const updatedCharacter = { ...character, [field]: value }

    setCharacters((current) =>
      current.map((item) => (item.id === id ? updatedCharacter : item)),
    )
    scheduleCharacterSave(updatedCharacter)
  }

  async function unlinkInboxItem(itemId) {
    const { error } = await supabase
      .from('inbox_items')
      .update({ linked_to: null })
      .eq('id', itemId)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadInboxItems()
  }

  async function addRelationship(relationship) {
    const { error } = await supabase.from('relationships').insert(relationship)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadRelationships()
  }

  async function deleteRelationship(id) {
    const { error } = await supabase.from('relationships').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadRelationships()
  }

  async function addFragment(fragment) {
    const { characterIds, ...fragmentFields } = fragment
    const nextOrderIndex =
      storyFragments.reduce(
        (highest, item) => Math.max(highest, item.order_index ?? 0),
        0,
      ) + 1

    const { data, error } = await supabase
      .from('story_fragments')
      .insert({
        ...fragmentFields,
        order_index: nextOrderIndex,
      })
      .select()
      .single()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    if (characterIds.length > 0) {
      const { error: linkError } = await supabase
        .from('fragment_characters')
        .insert(
          characterIds.map((characterId) => ({
            fragment_id: data.id,
            character_id: characterId,
          })),
        )

      if (linkError) {
        setErrorMessage(linkError.message)
        return
      }
    }

    await Promise.all([loadStoryFragments(), loadFragmentCharacters()])
  }

  async function deleteFragment(id) {
    const { error } = await supabase.from('story_fragments').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await Promise.all([loadStoryFragments(), loadFragmentCharacters()])
  }

  async function attachFragmentCharacter(fragmentId, characterId) {
    const alreadyLinked = fragmentCharacters.some(
      (item) =>
        item.fragment_id === fragmentId && item.character_id === characterId,
    )

    if (alreadyLinked) return

    const { error } = await supabase.from('fragment_characters').insert({
      fragment_id: fragmentId,
      character_id: characterId,
    })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadFragmentCharacters()
  }

  async function detachFragmentCharacter(fragmentId, characterId) {
    const { error } = await supabase
      .from('fragment_characters')
      .delete()
      .eq('fragment_id', fragmentId)
      .eq('character_id', characterId)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadFragmentCharacters()
  }

  async function moveFragment(fragmentId, direction) {
    const currentIndex = storyFragments.findIndex((item) => item.id === fragmentId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const currentFragment = storyFragments[currentIndex]
    const targetFragment = storyFragments[targetIndex]

    if (!currentFragment || !targetFragment) return

    const { error: currentError } = await supabase
      .from('story_fragments')
      .update({ order_index: targetFragment.order_index })
      .eq('id', currentFragment.id)

    if (currentError) {
      setErrorMessage(currentError.message)
      return
    }

    const { error: targetError } = await supabase
      .from('story_fragments')
      .update({ order_index: currentFragment.order_index })
      .eq('id', targetFragment.id)

    if (targetError) {
      setErrorMessage(targetError.message)
      return
    }

    await loadStoryFragments()
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MelodyWeb</p>
          <h1>Story workspace</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsLoading(true)
            loadData()
          }}
        >
          Refresh data
        </button>
      </header>

      {errorMessage && (
        <div className="error-banner" role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage('')}>
            Tutup
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="loading-state">Memuat data dari Supabase...</p>
      ) : (
        <>
          <nav className="main-tabs" aria-label="Navigasi utama">
            {navigationTabs.map((tab) => (
              <button
                type="button"
                className={activeTab === tab.id ? 'active' : ''}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'inbox' && (
            <Inbox
              characters={characters}
              inboxItems={inboxItems}
              onRefresh={loadInboxItems}
              onError={setErrorMessage}
            />
          )}

          {activeTab === 'characters' && (
            <CharacterBoard
              characters={characters}
              inboxItems={inboxItems}
              onAddCharacter={addCharacter}
              onUpdateCharacter={updateCharacterField}
              onUnlinkInboxItem={unlinkInboxItem}
              saveStatus={saveStatus}
            />
          )}

          {activeTab === 'relationships' && (
            <RelationshipMap
              characters={characters}
              relationships={relationships}
              onAddRelationship={addRelationship}
              onDeleteRelationship={deleteRelationship}
            />
          )}

          {activeTab === 'story' && (
            <StoryBoard
              characters={characters}
              storyFragments={storyFragments}
              fragmentCharacters={fragmentCharacters}
              onAddFragment={addFragment}
              onDeleteFragment={deleteFragment}
              onAttachFragmentCharacter={attachFragmentCharacter}
              onDetachFragmentCharacter={detachFragmentCharacter}
              onMoveFragment={moveFragment}
            />
          )}
        </>
      )}
    </main>
  )
}

export default App
