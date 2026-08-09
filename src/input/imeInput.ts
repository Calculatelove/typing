import { normalizeInputText } from './graphemes'

export interface ImeInputState {
  readonly composing: boolean
  readonly nextVersion: number
  readonly pendingComposition?: { readonly version: number; readonly text: string }
  readonly suppressedText?: string
}

export type ImeInputEvent =
  | { readonly type: 'compositionstart' }
  | { readonly type: 'compositionupdate'; readonly text: string }
  | { readonly type: 'compositionend'; readonly text: string }
  | { readonly type: 'input'; readonly text: string; readonly isComposing: boolean }

export interface ImeInputResult {
  readonly state: ImeInputState
  readonly committedText?: string
  readonly fallbackVersion?: number
  readonly releaseSuppression?: boolean
}

export function clearImeSuppression(state: ImeInputState): ImeInputState {
  return state.suppressedText === undefined ? state : { ...state, suppressedText: undefined }
}

export function shouldBlockBrowserInputType(inputType: string): boolean {
  return inputType === 'insertFromPaste' || inputType === 'insertFromDrop'
}

export function createImeInputState(): ImeInputState {
  return { composing: false, nextVersion: 0 }
}

export function reduceImeInput(state: ImeInputState, event: ImeInputEvent): ImeInputResult {
  if (event.type === 'compositionstart') {
    return {
      state: { ...state, composing: true, pendingComposition: undefined, suppressedText: undefined },
    }
  }
  if (event.type === 'compositionupdate') return { state }
  if (event.type === 'compositionend') {
    const version = state.nextVersion + 1
    return {
      state: {
        ...state,
        composing: false,
        nextVersion: version,
        pendingComposition: { version, text: normalizeInputText(event.text) },
      },
      fallbackVersion: version,
    }
  }
  if (event.isComposing || state.composing) return { state }

  const text = normalizeInputText(event.text)
  if (state.suppressedText !== undefined && text === state.suppressedText) {
    return { state: clearImeSuppression(state) }
  }
  const unsuppressedState = clearImeSuppression(state)
  if (unsuppressedState.pendingComposition !== undefined) {
    const committedText = text || unsuppressedState.pendingComposition.text
    return {
      state: {
        ...unsuppressedState,
        pendingComposition: undefined,
        suppressedText: committedText,
      },
      ...(committedText ? { committedText } : {}),
      releaseSuppression: true,
    }
  }
  return { state: unsuppressedState, ...(text ? { committedText: text } : {}) }
}

export function consumeImeFallback(state: ImeInputState, version: number): ImeInputResult {
  if (state.pendingComposition?.version !== version) return { state }
  const text = state.pendingComposition.text
  return {
    state: {
      ...state,
      pendingComposition: undefined,
      suppressedText: text,
    },
    ...(text ? { committedText: text } : {}),
  }
}
