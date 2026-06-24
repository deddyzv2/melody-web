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

const storySubTabs = [
  { id: 'full', label: 'Cerita Full' },
  { id: 'ringkasan', label: 'Cerita Ringkasan' },
  { id: 'timeline', label: 'Timeline Plot' },
  { id: 'komik', label: 'Versi Komik' },
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

                <div
                  className={`character-expand ${isExpanded ? 'expanded' : ''}`}
                  aria-hidden={!isExpanded}
                >
                  <div className="character-expand-inner">
                    <div className="character-form">
                      <div className="character-form-header">
                        <h3>Edit karakter</h3>
                        <button
                          type="button"
                          className="small-button"
                          onClick={() => setExpandedCharacterKey(null)}
                          tabIndex={isExpanded ? 0 : -1}
                        >
                          Tutup
                        </button>
                      </div>
                      <label>
                        Nama
                        <input
                          value={character.name || ''}
                          onChange={(event) =>
                            onUpdateCharacter(
                              character.id,
                              'name',
                              event.target.value,
                            )
                          }
                          tabIndex={isExpanded ? 0 : -1}
                        />
                      </label>
                      <label>
                        Role
                        <input
                          value={character.role || ''}
                          onChange={(event) =>
                            onUpdateCharacter(
                              character.id,
                              'role',
                              event.target.value,
                            )
                          }
                          tabIndex={isExpanded ? 0 : -1}
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
                          tabIndex={isExpanded ? 0 : -1}
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
                          tabIndex={isExpanded ? 0 : -1}
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
                                    tabIndex={isExpanded ? 0 : -1}
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
                  </div>
                </div>
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

function ChapterEditor({
  type,
  chapters,
  selectedChapterId,
  saveStatus,
  onSelectChapter,
  onAddChapter,
  onDeleteChapter,
  onMoveChapter,
  onUpdateChapter,
}) {
  const filteredChapters = chapters
    .filter((chapter) => chapter.type === type)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const selectedChapter =
    filteredChapters.find((chapter) => chapter.id === selectedChapterId) ||
    filteredChapters[0]

  useEffect(() => {
    if (!selectedChapter && selectedChapterId) {
      onSelectChapter(type, null)
    }
  }, [onSelectChapter, selectedChapter, selectedChapterId, type])

  function formatSavedAt(value) {
    if (!value) return 'Belum tersimpan'

    return `Tersimpan terakhir ${formatDate(value)}`
  }

  return (
    <div className="chapter-workspace">
      <aside className="chapter-sidebar">
        <button type="button" onClick={() => onAddChapter(type)}>
          + Chapter baru
        </button>

        {filteredChapters.length === 0 ? (
          <p className="empty-state">Belum ada chapter.</p>
        ) : (
          <div className="chapter-list">
            {filteredChapters.map((chapter, index) => (
              <article
                className={`chapter-list-item ${
                  selectedChapter?.id === chapter.id ? 'active' : ''
                }`}
                key={chapter.id}
              >
                <button
                  type="button"
                  className="chapter-title-button"
                  onClick={() => onSelectChapter(type, chapter.id)}
                >
                  {chapter.title || 'Chapter tanpa judul'}
                </button>
                <div className="chapter-row-actions">
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => onMoveChapter(type, chapter.id, 'up')}
                    disabled={index === 0}
                  >
                    Atas
                  </button>
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => onMoveChapter(type, chapter.id, 'down')}
                    disabled={index === filteredChapters.length - 1}
                  >
                    Bawah
                  </button>
                  <button
                    type="button"
                    className="danger-button small-button"
                    onClick={() => onDeleteChapter(chapter.id)}
                  >
                    Hapus
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </aside>

      <section className="chapter-editor">
        {selectedChapter ? (
          <>
            <input
              value={selectedChapter.title || ''}
              onChange={(event) =>
                onUpdateChapter(selectedChapter.id, 'title', event.target.value)
              }
              placeholder="Judul chapter"
            />
            <textarea
              value={selectedChapter.content || ''}
              onChange={(event) =>
                onUpdateChapter(selectedChapter.id, 'content', event.target.value)
              }
              placeholder="Tulis cerita di sini..."
              rows={18}
            />
            <p className="save-status">
              {saveStatus[selectedChapter.id] ||
                formatSavedAt(selectedChapter.updated_at)}
            </p>
          </>
        ) : (
          <p className="empty-state">Pilih atau buat chapter baru.</p>
        )}
      </section>
    </div>
  )
}

function TimelinePlot({
  characters,
  storyFragments,
  fragmentCharacters,
  onAddFragment,
  onDeleteFragment,
  onAttachFragmentCharacter,
  onDetachFragmentCharacter,
  onMoveFragment,
  onUpdateFragmentRoute,
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedRoute, setSelectedRoute] = useState('Rute Utama')
  const [activeRoute, setActiveRoute] = useState('Rute Utama')
  const [customRoutes, setCustomRoutes] = useState([])
  const [newRouteName, setNewRouteName] = useState('')
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
      route_name: selectedRoute,
      characterIds: selectedFormCharacterIds,
    })

    setTitle('')
    setContent('')
    setSelectedFormCharacterIds([])
    setIsFormPickerOpen(false)
  }

  const routeNames = Array.from(
    new Set([
      'Rute Utama',
      ...customRoutes,
      ...storyFragments.map((fragment) => fragment.route_name || 'Rute Utama'),
    ]),
  )
  const filteredFragments = storyFragments.filter(
    (fragment) => (fragment.route_name || 'Rute Utama') === activeRoute,
  )

  function addRoute() {
    const trimmedRoute = newRouteName.trim()
    if (!trimmedRoute) return

    setSelectedRoute(trimmedRoute)
    setActiveRoute(trimmedRoute)
    setCustomRoutes((current) =>
      current.includes(trimmedRoute) ? current : [...current, trimmedRoute],
    )
    setNewRouteName('')
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
    await onMoveFragment(fragmentId, direction, activeRoute)
    setBusyFragmentId(null)
  }

  async function deleteFragment(fragmentId) {
    setBusyFragmentId(fragmentId)
    await onDeleteFragment(fragmentId)
    setBusyFragmentId(null)
  }

  return (
    <div className="timeline-panel" ref={boardRef}>
      <div className="route-toolbar">
        <label>
          Rute
          <select
            value={activeRoute}
            onChange={(event) => {
              setActiveRoute(event.target.value)
              setSelectedRoute(event.target.value)
            }}
          >
            {routeNames.map((routeName) => (
              <option key={routeName} value={routeName}>
                {routeName}
              </option>
            ))}
          </select>
        </label>
        <div className="new-route-form">
          <input
            value={newRouteName}
            onChange={(event) => setNewRouteName(event.target.value)}
            placeholder="Nama rute baru"
          />
          <button type="button" onClick={addRoute} disabled={!newRouteName.trim()}>
            + Rute baru
          </button>
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
        <label className="route-select-label">
          Masuk rute
          <select
            value={selectedRoute}
            onChange={(event) => setSelectedRoute(event.target.value)}
          >
            {routeNames.map((routeName) => (
              <option key={routeName} value={routeName}>
                {routeName}
              </option>
            ))}
          </select>
        </label>
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

      {filteredFragments.length === 0 ? (
        <p className="empty-state">Belum ada potongan cerita di rute ini.</p>
      ) : (
        <div className="story-list timeline-list">
          {filteredFragments.map((fragment, index) => {
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

                <label className="route-select-label compact">
                  Rute fragment
                  <select
                    value={fragment.route_name || 'Rute Utama'}
                    onChange={(event) =>
                      onUpdateFragmentRoute(fragment.id, event.target.value)
                    }
                  >
                    {routeNames.map((routeName) => (
                      <option key={routeName} value={routeName}>
                        {routeName}
                      </option>
                    ))}
                  </select>
                </label>

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
                      index === filteredFragments.length - 1 ||
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
    </div>
  )
}

function ComicVersion({
  comicPages,
  comicPanels,
  comicSaveStatus,
  onAddComicPage,
  onDeleteComicPage,
  onMoveComicPage,
  onUpdateComicPage,
  onAddComicPanel,
  onDeleteComicPanel,
  onMoveComicPanel,
  onUpdateComicPanel,
}) {
  const [expandedPageId, setExpandedPageId] = useState(null)

  function getPanelsForPage(pageId) {
    return comicPanels
      .filter((panel) => panel.comic_page_id === pageId)
      .sort((a, b) => (a.panel_number ?? 0) - (b.panel_number ?? 0))
  }

  return (
    <div className="comic-version">
      <div className="comic-toolbar">
        <h3>Halaman komik</h3>
        <button type="button" onClick={onAddComicPage}>
          + Halaman baru
        </button>
      </div>

      {comicPages.length === 0 ? (
        <p className="empty-state">Belum ada halaman komik.</p>
      ) : (
        <div className="comic-page-list">
          {comicPages.map((page, pageIndex) => {
            const isExpanded = expandedPageId === page.id
            const panels = getPanelsForPage(page.id)

            return (
              <article className="comic-page-card" key={page.id}>
                <button
                  type="button"
                  className="comic-page-summary"
                  onClick={() =>
                    setExpandedPageId((current) =>
                      current === page.id ? null : page.id,
                    )
                  }
                >
                  <span>
                    <strong>{page.title || `Halaman ${page.order_index}`}</strong>
                    <small>{panels.length} panel</small>
                  </span>
                </button>

                <div className="story-actions">
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => onMoveComicPage(page.id, 'up')}
                    disabled={pageIndex === 0}
                  >
                    Atas
                  </button>
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => onMoveComicPage(page.id, 'down')}
                    disabled={pageIndex === comicPages.length - 1}
                  >
                    Bawah
                  </button>
                  <button
                    type="button"
                    className="danger-button small-button"
                    onClick={() => onDeleteComicPage(page.id)}
                  >
                    Hapus halaman
                  </button>
                </div>

                {isExpanded && (
                  <div className="comic-page-detail">
                    <label>
                      Ringkasan halaman
                      <textarea
                        value={page.summary || ''}
                        onChange={(event) =>
                          onUpdateComicPage(page.id, 'summary', event.target.value)
                        }
                        rows={4}
                        placeholder="Ringkas isi halaman komik ini..."
                      />
                    </label>
                    <p className="save-status">
                      {comicSaveStatus[page.id] || 'Perubahan tersimpan otomatis'}
                    </p>

                    <div className="comic-panel-header">
                      <h3>Panel</h3>
                      <button type="button" onClick={() => onAddComicPanel(page.id)}>
                        + Tambah panel
                      </button>
                    </div>

                    {panels.length === 0 ? (
                      <p className="empty-state">Belum ada panel.</p>
                    ) : (
                      <div className="comic-panel-list">
                        {panels.map((panel, panelIndex) => (
                          <article className="comic-panel-card" key={panel.id}>
                            <div className="comic-panel-title">
                              <strong>Panel {panel.panel_number}</strong>
                              <div className="story-actions">
                                <button
                                  type="button"
                                  className="small-button"
                                  onClick={() =>
                                    onMoveComicPanel(page.id, panel.id, 'up')
                                  }
                                  disabled={panelIndex === 0}
                                >
                                  Atas
                                </button>
                                <button
                                  type="button"
                                  className="small-button"
                                  onClick={() =>
                                    onMoveComicPanel(page.id, panel.id, 'down')
                                  }
                                  disabled={panelIndex === panels.length - 1}
                                >
                                  Bawah
                                </button>
                                <button
                                  type="button"
                                  className="danger-button small-button"
                                  onClick={() => onDeleteComicPanel(panel.id)}
                                >
                                  Hapus
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={panel.description || ''}
                              onChange={(event) =>
                                onUpdateComicPanel(
                                  panel.id,
                                  event.target.value,
                                )
                              }
                              rows={3}
                              placeholder="Keterangan panel, angle, aksi, dialog..."
                            />
                            <p className="save-status">
                              {comicSaveStatus[panel.id] ||
                                'Perubahan tersimpan otomatis'}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StoryBoard({
  characters,
  storyFragments,
  fragmentCharacters,
  storyChapters,
  selectedChapterIds,
  chapterSaveStatus,
  onAddFragment,
  onDeleteFragment,
  onAttachFragmentCharacter,
  onDetachFragmentCharacter,
  onMoveFragment,
  onUpdateFragmentRoute,
  onSelectChapter,
  onAddChapter,
  onDeleteChapter,
  onMoveChapter,
  onUpdateChapter,
  comicPages,
  comicPanels,
  comicSaveStatus,
  onAddComicPage,
  onDeleteComicPage,
  onMoveComicPage,
  onUpdateComicPage,
  onAddComicPanel,
  onDeleteComicPanel,
  onMoveComicPanel,
  onUpdateComicPanel,
}) {
  const [activeStoryTab, setActiveStoryTab] = useState('full')

  return (
    <section className="panel storyboard-panel">
      <div className="section-heading">
        <div>
          <h2>Rak Cerita</h2>
          <p>Simpan versi panjang, ringkasan, plot, dan naskah komik di satu rak.</p>
        </div>
      </div>

      <nav className="story-subtabs" aria-label="Navigasi Rak Cerita">
        {storySubTabs.map((tab) => (
          <button
            type="button"
            className={activeStoryTab === tab.id ? 'active' : ''}
            key={tab.id}
            onClick={() => setActiveStoryTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeStoryTab === 'full' && (
        <ChapterEditor
          type="full"
          chapters={storyChapters}
          selectedChapterId={selectedChapterIds.full}
          saveStatus={chapterSaveStatus}
          onSelectChapter={onSelectChapter}
          onAddChapter={onAddChapter}
          onDeleteChapter={onDeleteChapter}
          onMoveChapter={onMoveChapter}
          onUpdateChapter={onUpdateChapter}
        />
      )}

      {activeStoryTab === 'ringkasan' && (
        <ChapterEditor
          type="ringkasan"
          chapters={storyChapters}
          selectedChapterId={selectedChapterIds.ringkasan}
          saveStatus={chapterSaveStatus}
          onSelectChapter={onSelectChapter}
          onAddChapter={onAddChapter}
          onDeleteChapter={onDeleteChapter}
          onMoveChapter={onMoveChapter}
          onUpdateChapter={onUpdateChapter}
        />
      )}

      {activeStoryTab === 'timeline' && (
        <TimelinePlot
          characters={characters}
          storyFragments={storyFragments}
          fragmentCharacters={fragmentCharacters}
          onAddFragment={onAddFragment}
          onDeleteFragment={onDeleteFragment}
          onAttachFragmentCharacter={onAttachFragmentCharacter}
          onDetachFragmentCharacter={onDetachFragmentCharacter}
          onMoveFragment={onMoveFragment}
          onUpdateFragmentRoute={onUpdateFragmentRoute}
        />
      )}

      {activeStoryTab === 'komik' && (
        <ComicVersion
          comicPages={comicPages}
          comicPanels={comicPanels}
          comicSaveStatus={comicSaveStatus}
          onAddComicPage={onAddComicPage}
          onDeleteComicPage={onDeleteComicPage}
          onMoveComicPage={onMoveComicPage}
          onUpdateComicPage={onUpdateComicPage}
          onAddComicPanel={onAddComicPanel}
          onDeleteComicPanel={onDeleteComicPanel}
          onMoveComicPanel={onMoveComicPanel}
          onUpdateComicPanel={onUpdateComicPanel}
        />
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
  const [storyChapters, setStoryChapters] = useState([])
  const [comicPages, setComicPages] = useState([])
  const [comicPanels, setComicPanels] = useState([])
  const [selectedChapterIds, setSelectedChapterIds] = useState({
    full: null,
    ringkasan: null,
  })
  const [chapterSaveStatus, setChapterSaveStatus] = useState({})
  const [comicSaveStatus, setComicSaveStatus] = useState({})
  const [activeTab, setActiveTab] = useState('inbox')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [saveStatus, setSaveStatus] = useState({})
  const saveTimers = useRef(new Map())
  const chapterSaveTimers = useRef(new Map())
  const comicSaveTimers = useRef(new Map())

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

  const loadStoryChapters = useCallback(async () => {
    const { data, error } = await supabase
      .from('story_chapters')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setStoryChapters(data || [])
  }, [])

  const loadComicPages = useCallback(async () => {
    const { data, error } = await supabase
      .from('comic_pages')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setComicPages(data || [])
  }, [])

  const loadComicPanels = useCallback(async () => {
    const { data, error } = await supabase
      .from('comic_panels')
      .select('*')
      .order('panel_number', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setComicPanels(data || [])
  }, [])

  const loadData = useCallback(async () => {
    await Promise.all([
      loadCharacters(),
      loadInboxItems(),
      loadRelationships(),
      loadStoryFragments(),
      loadFragmentCharacters(),
      loadStoryChapters(),
      loadComicPages(),
      loadComicPanels(),
    ])
    setIsLoading(false)
  }, [
    loadCharacters,
    loadInboxItems,
    loadRelationships,
    loadStoryFragments,
    loadFragmentCharacters,
    loadStoryChapters,
    loadComicPages,
    loadComicPanels,
  ])

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadData()
    }, 0)

    return () => clearTimeout(initialLoad)
  }, [loadData])

  useEffect(() => {
    const timers = saveTimers.current
    const chapterTimers = chapterSaveTimers.current
    const comicTimers = comicSaveTimers.current

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      chapterTimers.forEach((timer) => clearTimeout(timer))
      comicTimers.forEach((timer) => clearTimeout(timer))
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
    const routeName = fragmentFields.route_name || 'Rute Utama'
    const nextOrderIndex =
      storyFragments
        .filter((item) => (item.route_name || 'Rute Utama') === routeName)
        .reduce(
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

  async function moveFragment(fragmentId, direction, routeName = 'Rute Utama') {
    const scopedFragments = storyFragments.filter(
      (item) => (item.route_name || 'Rute Utama') === routeName,
    )
    const currentIndex = scopedFragments.findIndex((item) => item.id === fragmentId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const currentFragment = scopedFragments[currentIndex]
    const targetFragment = scopedFragments[targetIndex]

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

  async function updateFragmentRoute(fragmentId, routeName) {
    const nextOrderIndex =
      storyFragments
        .filter((item) => (item.route_name || 'Rute Utama') === routeName)
        .reduce(
          (highest, item) => Math.max(highest, item.order_index ?? 0),
          0,
        ) + 1

    const { error } = await supabase
      .from('story_fragments')
      .update({
        route_name: routeName,
        order_index: nextOrderIndex,
      })
      .eq('id', fragmentId)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadStoryFragments()
  }

  function selectChapter(type, id) {
    setSelectedChapterIds((current) => ({
      ...current,
      [type]: id,
    }))
  }

  async function addChapter(type) {
    const nextOrderIndex =
      storyChapters
        .filter((chapter) => chapter.type === type)
        .reduce(
          (highest, chapter) => Math.max(highest, chapter.order_index ?? 0),
          0,
        ) + 1

    const { data, error } = await supabase
      .from('story_chapters')
      .insert({
        type,
        title: type === 'full' ? 'Chapter baru' : 'Ringkasan baru',
        content: '',
        order_index: nextOrderIndex,
      })
      .select()
      .single()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setStoryChapters((current) =>
      [...current, data].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    )
    selectChapter(type, data.id)
  }

  async function deleteChapter(id) {
    const chapter = storyChapters.find((item) => item.id === id)
    const { error } = await supabase.from('story_chapters').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    if (chapter) {
      setSelectedChapterIds((current) => ({
        ...current,
        [chapter.type]: current[chapter.type] === id ? null : current[chapter.type],
      }))
    }

    await loadStoryChapters()
  }

  async function moveChapter(type, id, direction) {
    const filteredChapters = storyChapters
      .filter((chapter) => chapter.type === type)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const currentIndex = filteredChapters.findIndex((chapter) => chapter.id === id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const currentChapter = filteredChapters[currentIndex]
    const targetChapter = filteredChapters[targetIndex]

    if (!currentChapter || !targetChapter) return

    const { error: currentError } = await supabase
      .from('story_chapters')
      .update({
        order_index: targetChapter.order_index,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentChapter.id)

    if (currentError) {
      setErrorMessage(currentError.message)
      return
    }

    const { error: targetError } = await supabase
      .from('story_chapters')
      .update({
        order_index: currentChapter.order_index,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetChapter.id)

    if (targetError) {
      setErrorMessage(targetError.message)
      return
    }

    await loadStoryChapters()
  }

  function updateChapter(id, field, value) {
    const chapter = storyChapters.find((item) => item.id === id)
    if (!chapter) return

    const updatedChapter = {
      ...chapter,
      [field]: value,
      updated_at: new Date().toISOString(),
    }

    setStoryChapters((current) =>
      current.map((item) => (item.id === id ? updatedChapter : item)),
    )
    scheduleChapterSave(updatedChapter)
  }

  function scheduleChapterSave(chapter) {
    const currentTimer = chapterSaveTimers.current.get(chapter.id)
    if (currentTimer) clearTimeout(currentTimer)

    setChapterSaveStatus((current) => ({
      ...current,
      [chapter.id]: 'Menunggu auto-save...',
    }))

    const timer = setTimeout(async () => {
      setChapterSaveStatus((current) => ({
        ...current,
        [chapter.id]: 'Menyimpan...',
      }))

      const savedAt = new Date().toISOString()
      const { error } = await supabase
        .from('story_chapters')
        .update({
          title: chapter.title,
          content: chapter.content,
          updated_at: savedAt,
        })
        .eq('id', chapter.id)

      if (error) {
        setErrorMessage(error.message)
        setChapterSaveStatus((current) => ({
          ...current,
          [chapter.id]: 'Gagal menyimpan',
        }))
        return
      }

      setStoryChapters((current) =>
        current.map((item) =>
          item.id === chapter.id ? { ...item, updated_at: savedAt } : item,
        ),
      )
      setChapterSaveStatus((current) => ({
        ...current,
        [chapter.id]: `Tersimpan terakhir ${formatDate(savedAt)}`,
      }))
    }, 800)

    chapterSaveTimers.current.set(chapter.id, timer)
  }

  async function addComicPage() {
    const nextOrderIndex =
      comicPages.reduce(
        (highest, page) => Math.max(highest, page.order_index ?? 0),
        0,
      ) + 1

    const { data, error } = await supabase
      .from('comic_pages')
      .insert({
        title: `Halaman ${nextOrderIndex}`,
        summary: '',
        order_index: nextOrderIndex,
      })
      .select()
      .single()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setComicPages((current) => [...current, data])
  }

  async function deleteComicPage(id) {
    const { error } = await supabase.from('comic_pages').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await Promise.all([loadComicPages(), loadComicPanels()])
  }

  async function moveComicPage(id, direction) {
    const currentIndex = comicPages.findIndex((page) => page.id === id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const currentPage = comicPages[currentIndex]
    const targetPage = comicPages[targetIndex]

    if (!currentPage || !targetPage) return

    const { error: currentError } = await supabase
      .from('comic_pages')
      .update({ order_index: targetPage.order_index })
      .eq('id', currentPage.id)

    if (currentError) {
      setErrorMessage(currentError.message)
      return
    }

    const { error: targetError } = await supabase
      .from('comic_pages')
      .update({ order_index: currentPage.order_index })
      .eq('id', targetPage.id)

    if (targetError) {
      setErrorMessage(targetError.message)
      return
    }

    await loadComicPages()
  }

  function updateComicPage(id, field, value) {
    const page = comicPages.find((item) => item.id === id)
    if (!page) return

    const updatedPage = { ...page, [field]: value }
    setComicPages((current) =>
      current.map((item) => (item.id === id ? updatedPage : item)),
    )
    scheduleComicPageSave(updatedPage)
  }

  function scheduleComicPageSave(page) {
    const key = `page-${page.id}`
    const currentTimer = comicSaveTimers.current.get(key)
    if (currentTimer) clearTimeout(currentTimer)

    setComicSaveStatus((current) => ({
      ...current,
      [page.id]: 'Menunggu auto-save...',
    }))

    const timer = setTimeout(async () => {
      setComicSaveStatus((current) => ({
        ...current,
        [page.id]: 'Menyimpan...',
      }))

      const { error } = await supabase
        .from('comic_pages')
        .update({
          title: page.title,
          summary: page.summary,
        })
        .eq('id', page.id)

      setComicSaveStatus((current) => ({
        ...current,
        [page.id]: error ? 'Gagal menyimpan' : 'Tersimpan',
      }))

      if (error) setErrorMessage(error.message)
    }, 800)

    comicSaveTimers.current.set(key, timer)
  }

  async function addComicPanel(pageId) {
    const nextPanelNumber =
      comicPanels
        .filter((panel) => panel.comic_page_id === pageId)
        .reduce(
          (highest, panel) => Math.max(highest, panel.panel_number ?? 0),
          0,
        ) + 1

    const { data, error } = await supabase
      .from('comic_panels')
      .insert({
        comic_page_id: pageId,
        panel_number: nextPanelNumber,
        description: '',
      })
      .select()
      .single()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setComicPanels((current) => [...current, data])
  }

  async function deleteComicPanel(id) {
    const { error } = await supabase.from('comic_panels').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadComicPanels()
  }

  async function moveComicPanel(pageId, id, direction) {
    const panels = comicPanels
      .filter((panel) => panel.comic_page_id === pageId)
      .sort((a, b) => (a.panel_number ?? 0) - (b.panel_number ?? 0))
    const currentIndex = panels.findIndex((panel) => panel.id === id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const currentPanel = panels[currentIndex]
    const targetPanel = panels[targetIndex]

    if (!currentPanel || !targetPanel) return

    const { error: currentError } = await supabase
      .from('comic_panels')
      .update({ panel_number: targetPanel.panel_number })
      .eq('id', currentPanel.id)

    if (currentError) {
      setErrorMessage(currentError.message)
      return
    }

    const { error: targetError } = await supabase
      .from('comic_panels')
      .update({ panel_number: currentPanel.panel_number })
      .eq('id', targetPanel.id)

    if (targetError) {
      setErrorMessage(targetError.message)
      return
    }

    await loadComicPanels()
  }

  function updateComicPanel(id, description) {
    const panel = comicPanels.find((item) => item.id === id)
    if (!panel) return

    const updatedPanel = { ...panel, description }
    setComicPanels((current) =>
      current.map((item) => (item.id === id ? updatedPanel : item)),
    )
    scheduleComicPanelSave(updatedPanel)
  }

  function scheduleComicPanelSave(panel) {
    const key = `panel-${panel.id}`
    const currentTimer = comicSaveTimers.current.get(key)
    if (currentTimer) clearTimeout(currentTimer)

    setComicSaveStatus((current) => ({
      ...current,
      [panel.id]: 'Menunggu auto-save...',
    }))

    const timer = setTimeout(async () => {
      setComicSaveStatus((current) => ({
        ...current,
        [panel.id]: 'Menyimpan...',
      }))

      const { error } = await supabase
        .from('comic_panels')
        .update({ description: panel.description })
        .eq('id', panel.id)

      setComicSaveStatus((current) => ({
        ...current,
        [panel.id]: error ? 'Gagal menyimpan' : 'Tersimpan',
      }))

      if (error) setErrorMessage(error.message)
    }, 800)

    comicSaveTimers.current.set(key, timer)
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
              storyChapters={storyChapters}
              selectedChapterIds={selectedChapterIds}
              chapterSaveStatus={chapterSaveStatus}
              comicPages={comicPages}
              comicPanels={comicPanels}
              comicSaveStatus={comicSaveStatus}
              onAddFragment={addFragment}
              onDeleteFragment={deleteFragment}
              onAttachFragmentCharacter={attachFragmentCharacter}
              onDetachFragmentCharacter={detachFragmentCharacter}
              onMoveFragment={moveFragment}
              onUpdateFragmentRoute={updateFragmentRoute}
              onSelectChapter={selectChapter}
              onAddChapter={addChapter}
              onDeleteChapter={deleteChapter}
              onMoveChapter={moveChapter}
              onUpdateChapter={updateChapter}
              onAddComicPage={addComicPage}
              onDeleteComicPage={deleteComicPage}
              onMoveComicPage={moveComicPage}
              onUpdateComicPage={updateComicPage}
              onAddComicPanel={addComicPanel}
              onDeleteComicPanel={deleteComicPanel}
              onMoveComicPanel={moveComicPanel}
              onUpdateComicPanel={updateComicPanel}
            />
          )}
        </>
      )}
    </main>
  )
}

export default App
