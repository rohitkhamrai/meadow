export class DigitalLetterModal {
  private overlay: HTMLDivElement
  private textarea: HTMLTextAreaElement
  private isOpen = false
  private onTextChangeListeners: ((text: string) => void)[] = []
  private internalUpdate = false

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'letter-overlay'

    this.overlay.innerHTML = `
      <div class="letter-stationery">
        <div class="letter-header">
          <h2 class="letter-heading">A Note from the Meadow</h2>
          <button class="letter-close-btn" title="Close note">✕</button>
        </div>
        <textarea
          class="letter-textarea"
          placeholder="Write a sweet message, leave a favorite lyric, or dedicate a song to someone listening with you..."
        ></textarea>
        <div class="letter-footer">
          <span>Shared live with anyone in this room</span>
          <span class="letter-wax-stamp">✦ SEALED</span>
        </div>
      </div>
    `

    this.textarea = this.overlay.querySelector<HTMLTextAreaElement>('.letter-textarea')!
    const closeBtn = this.overlay.querySelector<HTMLButtonElement>('.letter-close-btn')!

    closeBtn.addEventListener('click', () => this.close())
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close()
    })

    this.textarea.addEventListener('input', () => {
      if (this.internalUpdate) return
      const text = this.textarea.value
      for (const listener of this.onTextChangeListeners) {
        listener(text)
      }
    })

    parent.appendChild(this.overlay)
  }

  get text(): string {
    return this.textarea.value
  }

  setText(text: string): void {
    if (this.textarea.value === text) return
    this.internalUpdate = true
    this.textarea.value = text
    this.internalUpdate = false
  }

  open(): void {
    this.isOpen = true
    this.overlay.classList.add('open')
    this.textarea.focus()
  }

  close(): void {
    this.isOpen = false
    this.overlay.classList.remove('open')
  }

  toggle(): void {
    if (this.isOpen) this.close()
    else this.open()
  }

  onTextChange(listener: (text: string) => void): () => void {
    this.onTextChangeListeners.push(listener)
    return () => {
      this.onTextChangeListeners = this.onTextChangeListeners.filter((l) => l !== listener)
    }
  }

  dispose(): void {
    this.overlay.remove()
  }
}
