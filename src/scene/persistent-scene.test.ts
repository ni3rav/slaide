import { describe, expect, it } from 'vitest'
import { toPersistentScene } from './persistent-scene.ts'

describe('toPersistentScene', () => {
  it('keeps drawing elements, background color, and binary files', () => {
    const scene = toPersistentScene(
      [
        { id: 'r1', type: 'rectangle', x: 10, y: 20 },
        { id: 't1', type: 'text', x: 30, y: 40 },
      ],
      {
        viewBackgroundColor: '#abcdef',
        theme: 'dark',
        currentItemStrokeColor: '#111111',
        scrollX: 500,
        scrollY: 200,
        zoom: { value: 2 },
        selectedElementIds: { r1: true },
        activeTool: { type: 'rectangle', locked: false },
        openDialog: { name: 'imageExport' },
        openMenu: 'canvas',
      },
      {
        file1: { id: 'file1', mimeType: 'image/png', dataURL: 'data:image/png;base64,abc' },
      },
    )

    expect(scene).toEqual({
      elements: [
        { id: 'r1', type: 'rectangle', x: 10, y: 20 },
        { id: 't1', type: 'text', x: 30, y: 40 },
      ],
      appState: {
        viewBackgroundColor: '#abcdef',
        theme: 'dark',
        currentItemStrokeColor: '#111111',
      },
      files: {
        file1: { id: 'file1', mimeType: 'image/png', dataURL: 'data:image/png;base64,abc' },
      },
    })
  })

  it('drops frames, embeds, and other forbidden element types', () => {
    const scene = toPersistentScene(
      [
        { id: 'ok', type: 'ellipse' },
        { id: 'frame', type: 'frame' },
        { id: 'embed', type: 'embeddable' },
        { id: 'magic', type: 'magicframe' },
        { id: 'iframe', type: 'iframe' },
      ],
      { viewBackgroundColor: '#ffffff' },
      {},
    )

    expect(scene.elements).toEqual([{ id: 'ok', type: 'ellipse' }])
  })

  it('preserves Excalidraw text formatting and text-tool defaults', () => {
    const formattedText = {
      id: 'text-1',
      type: 'text',
      fontFamily: 2,
      fontSize: 32,
      textAlign: 'right',
      verticalAlign: 'middle',
      lineHeight: 1.4,
      strokeColor: '#123456',
      opacity: 65,
      text: 'Formatted',
      originalText: 'Formatted',
      autoResize: false,
      containerId: null,
    }

    const scene = toPersistentScene(
      [formattedText],
      {
        currentItemFontFamily: 2,
        currentItemFontSize: 32,
        currentItemTextAlign: 'right',
      },
      {},
    )

    expect(scene.elements).toEqual([formattedText])
    expect(scene.appState).toEqual({
      currentItemFontFamily: 2,
      currentItemFontSize: 32,
      currentItemTextAlign: 'right',
    })
  })
})
