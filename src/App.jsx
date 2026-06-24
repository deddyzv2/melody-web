import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import DOMPurify from 'dompurify'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
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

const deleteConfirmationMessage =
  'Yakin ingin menghapus ini? Tindakan ini tidak bisa dibatalkan.'

const allowedTextAlignments = new Set(['left', 'center', 'right', 'justify'])

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName !== 'style') return

  const textAlignMatch = String(data.attrValue || '').match(
    /text-align\s*:\s*(left|center|right|justify)/i,
  )

  if (textAlignMatch) {
    data.attrValue = `text-align: ${textAlignMatch[1].toLowerCase()}`
    return
  }

  data.keepAttr = false
})

function confirmDelete() {
  return window.confirm(deleteConfirmationMessage)
}

function formatDate(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function plainTextToHtml(value) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trimEnd())
    .filter(Boolean)

  if (paragraphs.length === 0) return '<p></p>'

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function sanitizeRichText(value) {
  if (!value) return '<p></p>'

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value)
  const html = looksLikeHtml ? value : plainTextToHtml(value)

  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['style'],
    USE_PROFILES: { html: true },
  })
}

function sanitizeFileName(value) {
  const baseName = value
    .trim()
    .toLowerCase()
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return baseName || 'chapter'
}

function getChapterTypeSlug(type) {
  return type === 'ringkasan' ? 'ringkasan' : 'cerita-full'
}

function getChapterExportBaseName(chapter, type) {
  return `${sanitizeFileName(chapter?.title || 'chapter')}-${getChapterTypeSlug(type)}`
}

function getSanitizedDocumentBody(content) {
  const template = document.createElement('template')
  template.innerHTML = sanitizeRichText(content)
  return template.content
}

function htmlToPlainText(content) {
  const body = getSanitizedDocumentBody(content)
  const lines = []

  function inlineText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
    if (node.nodeName === 'BR') return '\n'

    return Array.from(node.childNodes).map(inlineText).join('')
  }

  function walk(node, orderedIndex = null) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) lines.push(text)
      return
    }

    const tagName = node.nodeName.toLowerCase()

    if (tagName === 'ul') {
      Array.from(node.children).forEach((child) => walk(child))
      lines.push('')
      return
    }

    if (tagName === 'ol') {
      Array.from(node.children).forEach((child, index) => walk(child, index + 1))
      lines.push('')
      return
    }

    if (tagName === 'li') {
      const prefix = orderedIndex ? `${orderedIndex}. ` : '- '
      lines.push(`${prefix}${inlineText(node).trim()}`)
      return
    }

    const text = inlineText(node).trim()
    if (text) lines.push(text)
    if (['p', 'h1', 'h2', 'h3', 'blockquote', 'div'].includes(tagName)) {
      lines.push('')
    }
  }

  Array.from(body.childNodes).forEach((node) => walk(node))

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function exportToTxt(chapter, type) {
  const title = chapter?.title?.trim() || 'Chapter tanpa judul'
  const body = htmlToPlainText(chapter?.content || '')
  const text = body ? `${title}\n\n${body}` : title
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })

  downloadBlob(blob, `${getChapterExportBaseName(chapter, type)}.txt`)
}

function getNodeTextAlignment(node) {
  const alignment = node?.style?.textAlign?.toLowerCase()
  return allowedTextAlignments.has(alignment) ? alignment : undefined
}

function getDocxAlignment(node) {
  const alignment =
    getNodeTextAlignment(node) ||
    getNodeTextAlignment(node?.querySelector?.('p,h1,h2,h3'))

  if (alignment === 'center') return AlignmentType.CENTER
  if (alignment === 'right') return AlignmentType.RIGHT
  if (alignment === 'justify') return AlignmentType.JUSTIFIED

  return undefined
}

function createDocxRuns(nodes, marks = {}) {
  return Array.from(nodes).flatMap((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent
        ? [
            new TextRun({
              text: node.textContent,
              bold: marks.bold,
              italics: marks.italics,
              underline: marks.underline ? {} : undefined,
              strike: marks.strike,
            }),
          ]
        : []
    }

    if (node.nodeName === 'BR') return [new TextRun({ break: 1 })]

    const tagName = node.nodeName.toLowerCase()
    const nextMarks = {
      ...marks,
      bold: marks.bold || tagName === 'strong' || tagName === 'b',
      italics: marks.italics || tagName === 'em' || tagName === 'i',
      underline: marks.underline || tagName === 'u',
      strike: marks.strike || tagName === 's' || tagName === 'strike',
    }

    return createDocxRuns(node.childNodes, nextMarks)
  })
}

function htmlToDocxParagraphs(content) {
  const body = getSanitizedDocumentBody(content)
  const paragraphs = []

  function addParagraphFromNode(node, options = {}) {
    const children = createDocxRuns(node.childNodes)
    paragraphs.push(
      new Paragraph({
        alignment: getDocxAlignment(node),
        ...options,
        children: children.length > 0 ? children : [new TextRun('')],
      }),
    )
  }

  Array.from(body.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) paragraphs.push(new Paragraph({ children: [new TextRun(text)] }))
      return
    }

    const tagName = node.nodeName.toLowerCase()

    if (tagName === 'h1' || tagName === 'h2') {
      addParagraphFromNode(node, { heading: HeadingLevel.HEADING_2 })
      return
    }

    if (tagName === 'h3') {
      addParagraphFromNode(node, { heading: HeadingLevel.HEADING_3 })
      return
    }

    if (tagName === 'blockquote') {
      const children = createDocxRuns(node.childNodes, { italics: true })
      paragraphs.push(
        new Paragraph({
          alignment: getDocxAlignment(node),
          children: children.length > 0 ? children : [new TextRun('')],
          indent: { left: 360 },
        }),
      )
      return
    }

    if (tagName === 'ul' || tagName === 'ol') {
      Array.from(node.children).forEach((child, index) => {
        if (child.nodeName.toLowerCase() !== 'li') return

        const prefix = tagName === 'ol' ? `${index + 1}. ` : '- '
        paragraphs.push(
          new Paragraph({
            alignment: getDocxAlignment(child) || getDocxAlignment(node),
            children: [
              new TextRun(prefix),
              ...createDocxRuns(child.childNodes),
            ],
          }),
        )
      })
      return
    }

    addParagraphFromNode(node)
  })

  return paragraphs
}

async function exportToDocx(chapter, type) {
  const title = chapter?.title?.trim() || 'Chapter tanpa judul'
  const contentParagraphs = htmlToDocxParagraphs(chapter?.content || '')
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph(''),
          ...contentParagraphs,
        ],
      },
    ],
  })
  const blob = await Packer.toBlob(document)

  downloadBlob(blob, `${getChapterExportBaseName(chapter, type)}.docx`)
}

function isCharacterIncomplete(character) {
  return ['role', 'personality', 'visual_notes'].some(
    (field) => !character[field]?.trim(),
  )
}

function getCharacterDisplayName(character) {
  return character?.name?.trim() || '(belum diberi nama)'
}

function buildRelationshipLayout(characters, relationships) {
  const connectedIds = new Set()

  relationships.forEach((relationship) => {
    connectedIds.add(relationship.character_a)
    connectedIds.add(relationship.character_b)
  })

  const connectedCharacters = characters.filter((character) =>
    connectedIds.has(character.id),
  )
  const isolatedCharacters = characters.filter(
    (character) => !connectedIds.has(character.id),
  )
  const positions = {}
  const isPositionSaved = (character) =>
    character.position_x !== null &&
    character.position_x !== undefined &&
    character.position_y !== null &&
    character.position_y !== undefined

  function placeGrid(items, bounds, isolated = false) {
    if (items.length === 0) return

    const columns = Math.min(
      items.length,
      Math.max(1, Math.ceil(Math.sqrt(items.length))),
    )
    const rows = Math.ceil(items.length / columns)
    const columnGap =
      columns === 1 ? 0 : (bounds.maxX - bounds.minX) / (columns - 1)
    const rowGap = rows === 1 ? 0 : (bounds.maxY - bounds.minY) / (rows - 1)

    items.forEach((character, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const singleColumnX = (bounds.minX + bounds.maxX) / 2
      const singleRowY = (bounds.minY + bounds.maxY) / 2

      positions[character.id] = {
        x: columns === 1 ? singleColumnX : bounds.minX + column * columnGap,
        y: rows === 1 ? singleRowY : bounds.minY + row * rowGap,
        name: getCharacterDisplayName(character),
        isolated,
      }
    })
  }

  characters.forEach((character) => {
    if (!isPositionSaved(character)) return

    positions[character.id] = {
      x: Number(character.position_x),
      y: Number(character.position_y),
      name: getCharacterDisplayName(character),
      isolated: !connectedIds.has(character.id),
    }
  })

  if (connectedCharacters.length > 0) {
    placeGrid(
      connectedCharacters.filter((character) => !positions[character.id]),
      isolatedCharacters.length > 0
        ? { minX: 120, maxX: 600, minY: 88, maxY: 270 }
        : { minX: 120, maxX: 600, minY: 110, maxY: 350 },
    )
  }

  placeGrid(
    isolatedCharacters.filter((character) => !positions[character.id]),
    connectedCharacters.length > 0
      ? { minX: 120, maxX: 600, minY: 382, maxY: 438 }
      : { minX: 120, maxX: 600, minY: 145, maxY: 340 },
    true,
  )

  return {
    hasIsolatedCharacters: isolatedCharacters.length > 0,
    positions,
  }
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
    if (!confirmDelete()) return

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
  sortMode,
  onSortModeChange,
}) {
  const [selectedCharacterKey, setSelectedCharacterKey] = useState(null)
  const sortedCharacters = useMemo(() => {
    return [...characters].sort((firstCharacter, secondCharacter) => {
      if (sortMode === 'name') {
        return getCharacterDisplayName(firstCharacter).localeCompare(
          getCharacterDisplayName(secondCharacter),
          'id',
          { sensitivity: 'base' },
        )
      }

      return (
        new Date(secondCharacter.created_at || 0).getTime() -
        new Date(firstCharacter.created_at || 0).getTime()
      )
    })
  }, [characters, sortMode])
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
        <div className="character-board-actions">
          <label className="sort-control">
            Urutkan
            <select
              value={sortMode}
              onChange={(event) => onSortModeChange(event.target.value)}
            >
              <option value="name">Nama (A-Z)</option>
              <option value="newest">Terbaru ditambahkan</option>
            </select>
          </label>
          <button type="button" onClick={onAddCharacter}>
            Tambah karakter baru
          </button>
        </div>
      </div>

      {characters.length === 0 ? (
        <p className="empty-state">Belum ada karakter.</p>
      ) : (
        <>
          <div className="character-grid">
            {sortedCharacters.map((character, index) => {
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

function RelationshipNode({ data }) {
  return (
    <div
      className={`relationship-flow-node${data.isolated ? ' isolated' : ''}`}
      title={data.isolated ? 'Belum ada relasi' : undefined}
    >
      <Handle
        className="relationship-flow-handle"
        type="target"
        position={Position.Left}
      />
      <div className="relationship-flow-node-name">{data.name}</div>
      {data.isolated && (
        <div className="relationship-flow-node-note">Belum ada relasi</div>
      )}
      <Handle
        className="relationship-flow-handle"
        type="source"
        position={Position.Right}
      />
    </div>
  )
}

function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}) {
  const { getZoom } = useReactFlow()
  const offset = data?.offset || 0
  const labelOffsetX = data?.labelOffsetX || 0
  const labelOffsetY = data?.labelOffsetY || 0
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const length = Math.hypot(dx, dy) || 1
  const normalX = -dy / length
  const normalY = dx / length
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  const controlX = midX + normalX * offset
  const controlY = midY + normalY * offset
  const edgePath = `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`
  const labelX = 0.25 * sourceX + 0.5 * controlX + 0.25 * targetX + labelOffsetX
  const labelY = 0.25 * sourceY + 0.5 * controlY + 0.25 * targetY + labelOffsetY

  function startLabelDrag(event) {
    event.preventDefault()
    event.stopPropagation()

    const zoom = getZoom() || 1
    const startClientX = event.clientX
    const startClientY = event.clientY
    const startOffsetX = labelOffsetX
    const startOffsetY = labelOffsetY
    let latestOffsetX = startOffsetX
    let latestOffsetY = startOffsetY

    function moveLabel(moveEvent) {
      moveEvent.preventDefault()
      latestOffsetX = startOffsetX + (moveEvent.clientX - startClientX) / zoom
      latestOffsetY = startOffsetY + (moveEvent.clientY - startClientY) / zoom
      data?.onLabelOffsetChange?.(id, latestOffsetX, latestOffsetY, false)
    }

    function stopLabelDrag() {
      document.removeEventListener('pointermove', moveLabel)
      document.removeEventListener('pointerup', stopLabelDrag)
      data?.onLabelOffsetChange?.(id, latestOffsetX, latestOffsetY, true)
    }

    document.addEventListener('pointermove', moveLabel)
    document.addEventListener('pointerup', stopLabelDrag, { once: true })
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className="relationship-flow-edge-path"
      />
      <EdgeLabelRenderer>
        <div
          className="relationship-flow-edge-label nodrag nopan"
          onPointerDown={startLabelDrag}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {data?.label || 'relasi'}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const relationshipNodeTypes = { relationshipNode: RelationshipNode }
const relationshipEdgeTypes = { relationshipEdge: RelationshipEdge }

function RichTextEditor({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Underline,
    ],
    content: sanitizeRichText(value),
    editorProps: {
      attributes: {
        class: 'rich-text-content',
        'data-placeholder': placeholder,
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(sanitizeRichText(currentEditor.getHTML()))
    },
  })

  useEffect(() => {
    if (!editor) return

    const nextContent = sanitizeRichText(value)
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, false)
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" aria-label="Toolbar format teks">
        <button
          type="button"
          className={editor.isActive('bold') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={editor.isActive('italic') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          I
        </button>
        <button
          type="button"
          className={editor.isActive('underline') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          U
        </button>
        <button
          type="button"
          className={editor.isActive('strike') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Strikethrough"
        >
          S
        </button>
        <button
          type="button"
          className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading"
        >
          H
        </button>
        <button
          type="button"
          className={editor.isActive('bulletList') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          Bullets
        </button>
        <button
          type="button"
          className={editor.isActive('orderedList') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          1. List
        </button>
        <button
          type="button"
          className={editor.isActive('blockquote') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Blockquote"
        >
          Quote
        </button>
        <span className="toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className={editor.isActive({ textAlign: 'left' }) ? 'active' : ''}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          aria-label="Align left"
        >
          Left
        </button>
        <button
          type="button"
          className={editor.isActive({ textAlign: 'center' }) ? 'active' : ''}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          aria-label="Align center"
        >
          Center
        </button>
        <button
          type="button"
          className={editor.isActive({ textAlign: 'right' }) ? 'active' : ''}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          aria-label="Align right"
        >
          Right
        </button>
        <button
          type="button"
          className={editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          aria-label="Align justify"
        >
          Justify
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function RelationshipMap({
  characters,
  relationships,
  onAddRelationship,
  onDeleteRelationship,
  onUpdateRelationship,
  onUpdateCharacterPosition,
}) {
  const [characterA, setCharacterA] = useState('')
  const [characterB, setCharacterB] = useState('')
  const [relationType, setRelationType] = useState('')
  const [busyRelationshipId, setBusyRelationshipId] = useState(null)
  const [editingRelationshipId, setEditingRelationshipId] = useState(null)
  const [editDraft, setEditDraft] = useState({
    character_a: '',
    character_b: '',
    relation_type: '',
  })
  const { hasIsolatedCharacters, positions } = useMemo(
    () => buildRelationshipLayout(characters, relationships),
    [characters, relationships],
  )
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const positionSaveTimers = useRef(new Map())
  const labelSaveTimers = useRef(new Map())

  useEffect(() => {
    const timers = positionSaveTimers.current
    const labelTimers = labelSaveTimers.current

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      labelTimers.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const updateRelationshipLabelOffset = useCallback(
    (id, labelOffsetX, labelOffsetY, shouldSave) => {
      setEdges((currentEdges) =>
        currentEdges.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                data: {
                  ...edge.data,
                  labelOffsetX,
                  labelOffsetY,
                },
              }
            : edge,
        ),
      )

      if (!shouldSave) return

      const currentTimer = labelSaveTimers.current.get(id)
      if (currentTimer) clearTimeout(currentTimer)

      const timer = setTimeout(() => {
        onUpdateRelationship(id, {
          label_offset_x: labelOffsetX,
          label_offset_y: labelOffsetY,
        })
      }, 300)

      labelSaveTimers.current.set(id, timer)
    },
    [onUpdateRelationship, setEdges],
  )

  useEffect(() => {
    setNodes(
      characters.map((character) => {
        const position = positions[character.id]

        return {
          id: character.id,
          type: 'relationshipNode',
          position: {
            x: position?.x ?? 120,
            y: position?.y ?? 120,
          },
          data: {
            name: getCharacterDisplayName(character),
            isolated: position?.isolated ?? true,
          },
        }
      }),
    )
  }, [characters, positions, setNodes])

  useEffect(() => {
    const groupedRelationships = relationships.reduce((groups, relationship) => {
      const pairKey = [relationship.character_a, relationship.character_b]
        .sort()
        .join('::')
      const currentGroup = groups.get(pairKey) || []

      currentGroup.push(relationship)
      groups.set(pairKey, currentGroup)

      return groups
    }, new Map())

    const offsetById = new Map()

    groupedRelationships.forEach((group) => {
      const middleIndex = (group.length - 1) / 2

      group.forEach((relationship, index) => {
        const baseOffset = group.length === 1 ? 0 : (index - middleIndex) * 56
        const canonicalSource =
          [relationship.character_a, relationship.character_b].sort()[0] ===
          relationship.character_a

        offsetById.set(
          relationship.id,
          canonicalSource ? baseOffset : -baseOffset,
        )
      })
    })

    setEdges(
      relationships.map((relationship) => ({
        id: relationship.id,
        source: relationship.character_a,
        target: relationship.character_b,
        type: 'relationshipEdge',
        data: {
          label: relationship.relation_type || 'relasi',
          offset: offsetById.get(relationship.id) || 0,
          labelOffsetX: Number(relationship.label_offset_x || 0),
          labelOffsetY: Number(relationship.label_offset_y || 0),
          onLabelOffsetChange: updateRelationshipLabelOffset,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#4f74b8',
          height: 18,
          width: 18,
        },
      })),
    )
  }, [relationships, setEdges, updateRelationshipLabelOffset])

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

  function startEditRelationship(relationship) {
    setEditingRelationshipId(relationship.id)
    setEditDraft({
      character_a: relationship.character_a || '',
      character_b: relationship.character_b || '',
      relation_type: relationship.relation_type || '',
    })
  }

  function cancelEditRelationship() {
    setEditingRelationshipId(null)
    setEditDraft({
      character_a: '',
      character_b: '',
      relation_type: '',
    })
  }

  async function saveRelationshipEdit(id) {
    if (
      !editDraft.character_a ||
      !editDraft.character_b ||
      editDraft.character_a === editDraft.character_b ||
      !editDraft.relation_type.trim()
    ) {
      return
    }

    setBusyRelationshipId(id)
    const isSaved = await onUpdateRelationship(id, {
      character_a: editDraft.character_a,
      character_b: editDraft.character_b,
      relation_type: editDraft.relation_type.trim(),
    })
    setBusyRelationshipId(null)
    if (isSaved) cancelEditRelationship()
  }

  function moveCharacterNodeEnd(_event, node) {
    const currentTimer = positionSaveTimers.current.get(node.id)
    if (currentTimer) clearTimeout(currentTimer)

    const timer = setTimeout(() => {
      onUpdateCharacterPosition(node.id, node.position.x, node.position.y)
    }, 300)

    positionSaveTimers.current.set(node.id, timer)
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
          Dari karakter
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
          Ke karakter
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

      <section className="map-section">
        <h3>Visualisasi peta relasi</h3>
        {characters.length === 0 ? (
          <p className="empty-state">Tambahkan karakter untuk mulai membuat peta.</p>
        ) : (
          <div className="relationship-flow-canvas">
            {hasIsolatedCharacters && (
              <div className="relationship-flow-hint">Belum ada relasi</div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={relationshipNodeTypes}
              edgeTypes={relationshipEdgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={moveCharacterNodeEnd}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.45}
              maxZoom={1.35}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#d8e6f8" gap={24} />
              <Controls />
              <MiniMap
                nodeColor={(node) =>
                  node.data?.isolated ? '#eef6ff' : '#5d83c7'
                }
                maskColor="rgba(239, 246, 255, 0.68)"
              />
            </ReactFlow>
          </div>
        )}
      </section>

      <section className="relationship-list-section">
        <h3>Daftar relasi</h3>
        <div className="relationship-list">
          {relationships.length === 0 ? (
            <p className="empty-state">Belum ada relasi.</p>
          ) : (
            relationships.map((relationship) => {
              const isEditing = editingRelationshipId === relationship.id

              return (
                <article
                  className={`relationship-row ${isEditing ? 'editing' : ''}`}
                  key={relationship.id}
                >
                  {isEditing ? (
                    <div className="relationship-edit-form">
                      <label>
                        Dari
                        <select
                          value={editDraft.character_a}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              character_a: event.target.value,
                            }))
                          }
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
                        Relasi
                        <input
                          value={editDraft.relation_type}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              relation_type: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Ke
                        <select
                          value={editDraft.character_b}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              character_b: event.target.value,
                            }))
                          }
                        >
                          <option value="">Pilih karakter</option>
                          {characters.map((character) => (
                            <option key={character.id} value={character.id}>
                              {getCharacterDisplayName(character)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="relationship-row-actions">
                        <button
                          type="button"
                          className="small-button"
                          onClick={() => saveRelationshipEdit(relationship.id)}
                          disabled={
                            busyRelationshipId === relationship.id ||
                            !editDraft.character_a ||
                            !editDraft.character_b ||
                            editDraft.character_a === editDraft.character_b ||
                            !editDraft.relation_type.trim()
                          }
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          className="small-button"
                          onClick={cancelEditRelationship}
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span>
                        {getCharacterName(relationship.character_a)} {'\u2192'}{' '}
                        {relationship.relation_type || 'relasi'} {'\u2192'}{' '}
                        {getCharacterName(relationship.character_b)}
                      </span>
                      <div className="relationship-row-actions">
                        <button
                          type="button"
                          className="small-button"
                          onClick={() => startEditRelationship(relationship)}
                          disabled={busyRelationshipId === relationship.id}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-button small-button"
                          onClick={() => deleteRelationship(relationship.id)}
                          disabled={busyRelationshipId === relationship.id}
                        >
                          Hapus
                        </button>
                      </div>
                    </>
                  )}
                </article>
              )
            })
          )}
        </div>
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
  const [exportStatus, setExportStatus] = useState({
    chapterId: null,
    type: null,
    message: '',
  })
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

  const currentExportStatus =
    exportStatus.chapterId === selectedChapter?.id && exportStatus.type === type
      ? exportStatus.message
      : ''

  function handleExportTxt() {
    if (!selectedChapter) return

    try {
      exportToTxt(selectedChapter, type)
      setExportStatus({
        chapterId: selectedChapter.id,
        type,
        message: 'TXT berhasil diexport',
      })
    } catch (error) {
      console.error('TXT export failed', error)
      setExportStatus({
        chapterId: selectedChapter.id,
        type,
        message: 'Gagal export TXT',
      })
    }
  }

  async function handleExportDocx() {
    if (!selectedChapter) return

    try {
      await exportToDocx(selectedChapter, type)
      setExportStatus({
        chapterId: selectedChapter.id,
        type,
        message: 'DOCX berhasil diexport',
      })
    } catch (error) {
      console.error('DOCX export failed', error)
      setExportStatus({
        chapterId: selectedChapter.id,
        type,
        message: 'Gagal export DOCX',
      })
    }
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
            <div className="chapter-editor-header">
              <input
                value={selectedChapter.title || ''}
                onChange={(event) =>
                  onUpdateChapter(selectedChapter.id, 'title', event.target.value)
                }
                placeholder="Judul chapter"
              />
              <div className="chapter-export-actions">
                <button
                  type="button"
                  className="small-button"
                  onClick={handleExportTxt}
                  disabled={!selectedChapter}
                >
                  Export TXT
                </button>
                <button
                  type="button"
                  className="small-button"
                  onClick={handleExportDocx}
                  disabled={!selectedChapter}
                >
                  Export DOCX
                </button>
              </div>
            </div>
            <RichTextEditor
              value={selectedChapter.content || ''}
              onChange={(content) =>
                onUpdateChapter(selectedChapter.id, 'content', content)
              }
              placeholder="Tulis cerita di sini..."
            />
            <p className="save-status">
              {saveStatus[selectedChapter.id] ||
                formatSavedAt(selectedChapter.updated_at)}
              {currentExportStatus ? ` · ${currentExportStatus}` : ''}
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
    <div className={`story-flow-node${data.isSelected ? ' selected' : ''}`}>
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
          isSelected: selectedFragmentId === fragment.id,
          onSelect: () => {
            setSelectedFragmentId(fragment.id)
            setSelectedConnectionId(null)
          },
          onAddChild: () => onAddChildFragment(fragment),
        },
      })),
    )
  }, [onAddChildFragment, selectedFragmentId, setNodes, storyFragments])

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
  activeStoryTab,
  onActiveStoryTabChange,
}) {
  return (
    <section className="panel storyboard-panel">
      <div className="subtab-group">
        <nav className="story-subtabs" aria-label="Navigasi Rak Cerita">
          {storySubTabs.map((tab) => (
            <button
              type="button"
              className={activeStoryTab === tab.id ? 'active' : ''}
              key={tab.id}
              onClick={() => onActiveStoryTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

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
  const [activeStoryTab, setActiveStoryTab] = useState('full')
  const [characterSortMode, setCharacterSortMode] = useState('newest')
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

  async function updateCharacterPosition(id, x, y) {
    setCharacters((current) =>
      current.map((character) =>
        character.id === id
          ? { ...character, position_x: x, position_y: y }
          : character,
      ),
    )

    const { error } = await supabase
      .from('characters')
      .update({
        position_x: x,
        position_y: y,
      })
      .eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    }
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
    if (!confirmDelete()) return

    const { error } = await supabase.from('relationships').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadRelationships()
  }

  async function updateRelationship(id, relationship) {
    const { error } = await supabase
      .from('relationships')
      .update(relationship)
      .eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      return false
    }

    await loadRelationships()
    return true
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
    if (!confirmDelete()) return

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
    if (!confirmDelete()) return

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
    if (!confirmDelete()) return

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
    if (!confirmDelete()) return

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
    if (!confirmDelete()) return

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
              sortMode={characterSortMode}
              onSortModeChange={setCharacterSortMode}
            />
          )}

          {activeTab === 'relationships' && (
            <RelationshipMap
              characters={characters}
              relationships={relationships}
              onAddRelationship={addRelationship}
              onDeleteRelationship={deleteRelationship}
              onUpdateRelationship={updateRelationship}
              onUpdateCharacterPosition={updateCharacterPosition}
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
              activeStoryTab={activeStoryTab}
              onActiveStoryTabChange={setActiveStoryTab}
            />
          )}
        </>
      )}
    </main>
  )
}

export default App
