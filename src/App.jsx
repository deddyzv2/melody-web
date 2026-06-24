import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
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
  const [selectedCharacterKey, setSelectedCharacterKey] = useState(null)
  const selectedCharacter = characters.find((character, index) => {
    const characterKey = character.id || `character-${index}`
    return characterKey === selectedCharacterKey
  })
  const selectedRelatedIdeas = selectedCharacter
    ? inboxItems.filter((item) => item.linked_to === selectedCharacter.id)
    : []

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
        <>
          <div className="character-grid">
            {characters.map((character, index) => {
              const characterKey = character.id || `character-${index}`
              const isSelected = selectedCharacterKey === characterKey
              const incomplete = isCharacterIncomplete(character)

              return (
                <article
                  className={`character-card ${incomplete ? 'incomplete' : ''} ${
                    isSelected ? 'selected' : ''
                  }`}
                  key={characterKey}
                >
                  <button
                    type="button"
                    className="card-summary"
                    onClick={() => setSelectedCharacterKey(characterKey)}
                  >
                    <span>
                      <strong>
                        {character.name?.trim() || 'Karakter tanpa nama'}
                      </strong>
                      <small>{character.role?.trim() || 'Role belum diisi'}</small>
                    </span>
                    {incomplete && <span className="badge">Belum lengkap</span>}
                  </button>
                </article>
              )
            })}
          </div>

          <section className="character-detail-panel">
            {selectedCharacter ? (
              <div className="character-form">
                <div className="character-form-header">
                  <h3>Panel Detail Karakter</h3>
                </div>
                <label>
                  Nama
                  <input
                    value={selectedCharacter.name || ''}
                    onChange={(event) =>
                      onUpdateCharacter(
                        selectedCharacter.id,
                        'name',
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  Role
                  <input
                    value={selectedCharacter.role || ''}
                    onChange={(event) =>
                      onUpdateCharacter(
                        selectedCharacter.id,
                        'role',
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  Personality
                  <textarea
                    value={selectedCharacter.personality || ''}
                    onChange={(event) =>
                      onUpdateCharacter(
                        selectedCharacter.id,
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
                    value={selectedCharacter.visual_notes || ''}
                    onChange={(event) =>
                      onUpdateCharacter(
                        selectedCharacter.id,
                        'visual_notes',
                        event.target.value,
                      )
                    }
                    rows={4}
                  />
                </label>
                <div className="related-ideas">
                  <h3>Ide terkait</h3>
                  {selectedRelatedIdeas.length === 0 ? (
                    <p className="related-placeholder">
                      Belum ada ide yang ditempel
                    </p>
                  ) : (
                    <div className="related-list">
                      {selectedRelatedIdeas.map((item) => (
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
                  {saveStatus[selectedCharacter.id] ||
                    'Perubahan tersimpan otomatis'}
                </p>
              </div>
            ) : (
              <p className="empty-state">
                Klik salah satu kartu di atas untuk melihat & edit detailnya.
              </p>
            )}
          </section>
        </>
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

function StoryNode({ data }) {
  return (
    <div className="story-flow-node">
      <Handle className="story-flow-handle" type="target" position={Position.Left} />
      <button
        type="button"
        className="story-flow-node-title"
        onClick={data.onSelect}
      >
        {data.title || 'Fragment tanpa judul'}
      </button>
      <button
        type="button"
        className="story-flow-add"
        onClick={(event) => {
          event.stopPropagation()
          data.onAddChild()
        }}
        aria-label="Tambah fragment lanjutan"
      >
        +
      </button>
      <Handle
        className="story-flow-handle"
        type="source"
        position={Position.Right}
      />
    </div>
  )
}

const storyNodeTypes = { storyNode: StoryNode }

function TimelinePlot({
  characters,
  storyFragments,
  fragmentConnections,
  fragmentCharacters,
  onAddFragment,
  onDeleteFragment,
  onAttachFragmentCharacter,
  onDetachFragmentCharacter,
  onAddChildFragment,
  onAddFragmentConnection,
  onDeleteFragmentConnection,
  onUpdateFragmentPosition,
  onUpdateFragmentDetail,
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedFragmentId, setSelectedFragmentId] = useState(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState(null)
  const [selectedFormCharacterIds, setSelectedFormCharacterIds] = useState([])
  const [isFormPickerOpen, setIsFormPickerOpen] = useState(false)
  const [openPickerId, setOpenPickerId] = useState(null)
  const [busyFragmentId, setBusyFragmentId] = useState(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
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

  const selectedFragment = storyFragments.find(
    (fragment) => fragment.id === selectedFragmentId,
  )
  const selectedConnection = fragmentConnections.find(
    (connection) => connection.id === selectedConnectionId,
  )

  function getLinkedCharacterIds(fragmentId) {
    return fragmentCharacters
      .filter((item) => item.fragment_id === fragmentId)
      .map((item) => item.character_id)
  }

  function getCharacterName(id) {
    const character = characters.find((item) => item.id === id)
    return getCharacterDisplayName(character)
  }

  useEffect(() => {
    setNodes(
      storyFragments.map((fragment, index) => ({
        id: fragment.id,
        type: 'storyNode',
        position: {
          x: Number(fragment.position_x ?? 120 + index * 48),
          y: Number(fragment.position_y ?? 120 + index * 36),
        },
        data: {
          title: fragment.title,
          onSelect: () => {
            setSelectedFragmentId(fragment.id)
            setSelectedConnectionId(null)
          },
          onAddChild: () => onAddChildFragment(fragment),
        },
      })),
    )
  }, [onAddChildFragment, setNodes, storyFragments])

  useEffect(() => {
    setEdges(
      fragmentConnections.map((connection) => ({
        id: connection.id,
        source: connection.from_fragment_id,
        target: connection.to_fragment_id,
        label: connection.label || undefined,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#5d83c7',
        },
        className: 'story-flow-edge',
        labelBgClassName: 'story-flow-edge-label-bg',
        labelClassName: 'story-flow-edge-label',
      })),
    )
  }, [fragmentConnections, setEdges])

  async function submitFragment(event) {
    event.preventDefault()

    if (!title.trim() && !content.trim()) return

    const createdFragment = await onAddFragment({
      title: title.trim() || 'Fragment baru',
      content: content.trim(),
      position_x: 120,
      position_y: 120,
      characterIds: selectedFormCharacterIds,
    })

    if (createdFragment?.id) setSelectedFragmentId(createdFragment.id)

    setTitle('')
    setContent('')
    setSelectedFormCharacterIds([])
    setIsFormPickerOpen(false)
  }

  const connectFragments = useCallback(
    async (connection) => {
      if (!connection.source || !connection.target) return

      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#5d83c7',
            },
          },
          currentEdges,
        ),
      )
      await onAddFragmentConnection(connection.source, connection.target)
    },
    [onAddFragmentConnection, setEdges],
  )

  async function moveNodeEnd(_event, node) {
    await onUpdateFragmentPosition(node.id, node.position.x, node.position.y)
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

  async function deleteFragment(fragmentId) {
    setBusyFragmentId(fragmentId)
    await onDeleteFragment(fragmentId)
    if (selectedFragmentId === fragmentId) setSelectedFragmentId(null)
    setBusyFragmentId(null)
  }

  return (
    <div className="timeline-panel" ref={boardRef}>
      <div className="story-flow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={storyNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={connectFragments}
          onNodeDragStop={moveNodeEnd}
          onNodeClick={(_event, node) => {
            setSelectedFragmentId(node.id)
            setSelectedConnectionId(null)
          }}
          onEdgeClick={(_event, edge) => {
            setSelectedConnectionId(edge.id)
            setSelectedFragmentId(null)
          }}
          fitView
        >
          <Background color="#d8e6f8" gap={22} />
          <MiniMap
            nodeColor="#8fb0e2"
            maskColor="rgba(232, 243, 255, 0.72)"
          />
          <Controls />
        </ReactFlow>
      </div>

      {selectedConnection && (
        <div className="edge-action-bar">
          <span>Panah terpilih</span>
          <button
            type="button"
            className="danger-button small-button"
            onClick={() => {
              onDeleteFragmentConnection(selectedConnection.id)
              setSelectedConnectionId(null)
            }}
          >
            Hapus panah
          </button>
        </div>
      )}

      <section className="fragment-detail-panel">
        {selectedFragment ? (
          <>
            <div className="fragment-detail-header">
              <h3>Detail fragment</h3>
              <button
                type="button"
                className="danger-button small-button"
                onClick={() => deleteFragment(selectedFragment.id)}
                disabled={busyFragmentId === selectedFragment.id}
              >
                Hapus fragment
              </button>
            </div>
            <input
              value={selectedFragment.title || ''}
              onChange={(event) =>
                onUpdateFragmentDetail(
                  selectedFragment.id,
                  'title',
                  event.target.value,
                )
              }
              placeholder="Judul fragment"
            />
            <textarea
              value={selectedFragment.content || ''}
              onChange={(event) =>
                onUpdateFragmentDetail(
                  selectedFragment.id,
                  'content',
                  event.target.value,
                )
              }
              placeholder="Isi/catatan"
              rows={7}
            />
            <div className="character-picker">
              <button
                type="button"
                className="character-picker-trigger"
                onClick={() =>
                  setOpenPickerId((current) =>
                    current === selectedFragment.id ? null : selectedFragment.id,
                  )
                }
              >
                {getLinkedCharacterIds(selectedFragment.id).length === 0
                  ? '+ Pilih karakter'
                  : `${getLinkedCharacterIds(selectedFragment.id).length} karakter terpilih`}
              </button>

              {openPickerId === selectedFragment.id && (
                <div className="checkbox-popover">
                  {characters.length === 0 ? (
                    <p className="empty-state">Belum ada karakter untuk dipilih.</p>
                  ) : (
                    <div className="checkbox-list">
                      {characters.map((character) => {
                        const linkedCharacterIds = getLinkedCharacterIds(
                          selectedFragment.id,
                        )
                        const isChecked = linkedCharacterIds.includes(character.id)

                        return (
                          <label className="checkbox-option" key={character.id}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) =>
                                toggleFragmentCharacter(
                                  selectedFragment.id,
                                  character.id,
                                  event.target.checked,
                                )
                              }
                              disabled={busyFragmentId === selectedFragment.id}
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
                {getLinkedCharacterIds(selectedFragment.id).length === 0 ? (
                  <span className="muted-badge">Belum ada karakter</span>
                ) : (
                  getLinkedCharacterIds(selectedFragment.id).map((characterId) => (
                    <span className="character-badge" key={characterId}>
                      {getCharacterName(characterId)}
                    </span>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="empty-state">
            Klik salah satu kartu di atas untuk melihat & edit detailnya
          </p>
        )}
      </section>

      <form className="story-form" onSubmit={submitFragment}>
        <h3>Tambah fragment lepas</h3>
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
  fragmentConnections,
  fragmentCharacters,
  storyChapters,
  selectedChapterIds,
  chapterSaveStatus,
  onAddFragment,
  onDeleteFragment,
  onAttachFragmentCharacter,
  onDetachFragmentCharacter,
  onAddChildFragment,
  onAddFragmentConnection,
  onDeleteFragmentConnection,
  onUpdateFragmentPosition,
  onUpdateFragmentDetail,
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
          fragmentConnections={fragmentConnections}
          fragmentCharacters={fragmentCharacters}
          onAddFragment={onAddFragment}
          onDeleteFragment={onDeleteFragment}
          onAttachFragmentCharacter={onAttachFragmentCharacter}
          onDetachFragmentCharacter={onDetachFragmentCharacter}
          onAddChildFragment={onAddChildFragment}
          onAddFragmentConnection={onAddFragmentConnection}
          onDeleteFragmentConnection={onDeleteFragmentConnection}
          onUpdateFragmentPosition={onUpdateFragmentPosition}
          onUpdateFragmentDetail={onUpdateFragmentDetail}
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
  const [fragmentConnections, setFragmentConnections] = useState([])
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
  const fragmentSaveTimers = useRef(new Map())

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

  const loadFragmentConnections = useCallback(async () => {
    const { data, error } = await supabase
      .from('fragment_connections')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setFragmentConnections(data || [])
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
      loadFragmentConnections(),
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
    loadFragmentConnections,
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
    const fragmentTimers = fragmentSaveTimers.current

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      chapterTimers.forEach((timer) => clearTimeout(timer))
      comicTimers.forEach((timer) => clearTimeout(timer))
      fragmentTimers.forEach((timer) => clearTimeout(timer))
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
        position_x: fragmentFields.position_x ?? 120,
        position_y: fragmentFields.position_y ?? 120,
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
        return null
      }
    }

    await Promise.all([loadStoryFragments(), loadFragmentCharacters()])
    return data
  }

  async function deleteFragment(id) {
    const { error } = await supabase.from('story_fragments').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await Promise.all([
      loadStoryFragments(),
      loadFragmentCharacters(),
      loadFragmentConnections(),
    ])
  }

  async function addChildFragment(parentFragment) {
    const child = await addFragment({
      title: 'Fragment baru',
      content: '',
      position_x: Number(parentFragment.position_x ?? 120) + 260,
      position_y: Number(parentFragment.position_y ?? 120) + 90,
      characterIds: [],
    })

    if (child?.id) {
      await addFragmentConnection(parentFragment.id, child.id)
    }
  }

  async function addFragmentConnection(sourceId, targetId) {
    if (sourceId === targetId) return

    const { error } = await supabase.from('fragment_connections').insert({
      from_fragment_id: sourceId,
      to_fragment_id: targetId,
      label: null,
    })

    if (error) {
      setErrorMessage(error.message)
      await loadFragmentConnections()
      return
    }

    await loadFragmentConnections()
  }

  async function deleteFragmentConnection(id) {
    const { error } = await supabase
      .from('fragment_connections')
      .delete()
      .eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadFragmentConnections()
  }

  async function updateFragmentPosition(id, x, y) {
    const { error } = await supabase
      .from('story_fragments')
      .update({
        position_x: x,
        position_y: y,
      })
      .eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setStoryFragments((current) =>
      current.map((fragment) =>
        fragment.id === id
          ? { ...fragment, position_x: x, position_y: y }
          : fragment,
      ),
    )
  }

  function updateFragmentDetail(id, field, value) {
    const fragment = storyFragments.find((item) => item.id === id)
    if (!fragment) return

    const updatedFragment = { ...fragment, [field]: value }
    setStoryFragments((current) =>
      current.map((item) => (item.id === id ? updatedFragment : item)),
    )
    scheduleFragmentSave(updatedFragment)
  }

  function scheduleFragmentSave(fragment) {
    const currentTimer = fragmentSaveTimers.current.get(fragment.id)
    if (currentTimer) clearTimeout(currentTimer)

    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from('story_fragments')
        .update({
          title: fragment.title,
          content: fragment.content,
        })
        .eq('id', fragment.id)

      if (error) setErrorMessage(error.message)
    }, 800)

    fragmentSaveTimers.current.set(fragment.id, timer)
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
              fragmentConnections={fragmentConnections}
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
              onAddChildFragment={addChildFragment}
              onAddFragmentConnection={addFragmentConnection}
              onDeleteFragmentConnection={deleteFragmentConnection}
              onUpdateFragmentPosition={updateFragmentPosition}
              onUpdateFragmentDetail={updateFragmentDetail}
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
